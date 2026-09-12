import { Page, test, expect } from '@playwright/test';
import {
  cancelEnrollment,
  clearCookies,
  cleanupEventsOnDate,
  createCalendarEvent,
  deleteCalendarEvent,
  deleteTestUser,
  enrollToEvent,
  futureDate,
  getCurrentUserInfo,
  getResolvedTestTariffs,
  getUserInfo,
  loginAsAdmin,
  loginAsStudent,
  purchaseSubscription,
  registerNewUser,
  setAllowedTariffs,
  setBalance,
  uniquePhone,
} from '../support/fixtures/helpers';

/**
 * Non-functional suite — robustness & idempotency.
 *
 * Guards the system against duplicate events, repeated operations and
 * malformed input: webhooks must not credit twice, enrollments must not
 * duplicate, retries must not corrupt state, and garbage input must never
 * turn into a 500.
 */
test.describe.configure({ mode: 'serial' });

const EVENT_DAY_OFFSET = 371;
const EVENT_DATE = futureDate(EVENT_DAY_OFFSET).slice(0, 10);

let TARIFF_GROUP_ID = 0;

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  try {
    const t = await getResolvedTestTariffs(page);
    TARIFF_GROUP_ID = t.groupId;
  } finally {
    await page.close();
  }
});

async function createFundedUser(page: Page, initialBalance: number): Promise<{ phone: string; id: number }> {
  const phone = uniquePhone();
  await registerNewUser(page, phone);
  const info = await getUserInfo(page, phone);
  const id = info.id!;

  await clearCookies(page);
  await loginAsAdmin(page);
  await setBalance(page, id, initialBalance);
  await setAllowedTariffs(page, id, [TARIFF_GROUP_ID]);
  await clearCookies(page);
  await loginAsStudent(page, phone);
  return { phone, id };
}

async function createRobustnessEvent(page: Page, hour: number): Promise<number> {
  await clearCookies(page);
  await loginAsAdmin(page);
  await cleanupEventsOnDate(page, EVENT_DATE);
  const created = await createCalendarEvent(page, {
    class_type_id: 1,
    start: futureDate(EVENT_DAY_OFFSET, { hour }),
    duration: 60,
    hall_id: 2,
    tariff_id: TARIFF_GROUP_ID,
    max_participants_override: 10,
  });
  return created.event!.id;
}

test.describe('Нефункциональные — отказоустойчивость и идемпотентность', { tag: ['@non-functional', '@regression'] }, () => {
  test('дубликат payment_id не зачисляет средства дважды', async ({ page }) => {
    const { phone, id } = await createFundedUser(page, 0);

    const paymentId = `dup-${Date.now()}`;
    const payload = {
      type: 'notification',
      event: 'payment.succeeded',
      object: {
        id: paymentId,
        status: 'succeeded',
        metadata: { action: 'topup', user_id: String(id), amount: '1000' },
      },
    };

    async function postWebhook(): Promise<number> {
      const response = await page.request.post('/api/yookassa/callback/', { data: payload });
      return response.status();
    }

    expect(await postWebhook()).toBe(200);
    const afterFirst = await getCurrentUserInfo(page);
    expect(Number(afterFirst.balance)).toBeCloseTo(1000, 2);

    // Повторный вебхук с тем же payment_id не должен зачислить повторно.
    expect(await postWebhook()).toBe(200);
    const afterSecond = await getCurrentUserInfo(page);
    expect(Number(afterSecond.balance)).toBeCloseTo(1000, 2);

    await deleteTestUser(page, phone);
  });

  test('некорректный вебхук не роняет сервис', async ({ page }) => {
    await clearCookies(page);
    await loginAsStudent(page);

    const garbage = await page.request.post('/api/yookassa/callback/', {
      data: { random: 'payload' },
    });
    // Сервис должен деградировать мягко (4xx/2xx), а не падать в 500.
    expect(garbage.status()).toBeLessThan(500);

    // После сбоя приложение продолжает работать.
    const ok = await page.request.get('/login/');
    expect(ok.status()).toBe(200);
  });

  test('повторная запись на занятие не создаёт дубликат', async ({ page }) => {
    const eventId = await createRobustnessEvent(page, 10);
    const { phone } = await createFundedUser(page, 5000);

    const first = await enrollToEvent(page, eventId);
    expect(first.success).toBeTruthy();

    let error = '';
    try {
      await enrollToEvent(page, eventId);
    } catch (e) {
      error = String(e);
    }
    expect(error).not.toBe('');

    // В списке посещаемости ровно одна запись студента.
    const userId = Number((await getUserInfo(page, phone)).id);
    const attendance = await page.request.get(`/api/calendar/events/${eventId}/attendance/`);
    const data = await attendance.json();
    const mine = (data.attendances as Array<{ client_id: number }>).filter(
      (a) => a.client_id === userId,
    );
    expect(mine).toHaveLength(1);

    await deleteTestUser(page, phone);
    await clearCookies(page);
    await loginAsAdmin(page);
    await deleteCalendarEvent(page, eventId);
  });

  test('повторная отмена записи не приводит к двойному возврату', async ({ page }) => {
    const eventId = await createRobustnessEvent(page, 11);
    const { phone } = await createFundedUser(page, 5000);
    const initialBalance = Number((await getCurrentUserInfo(page)).balance);

    const enrolled = await enrollToEvent(page, eventId);
    expect(enrolled.success).toBeTruthy();

    const afterEnroll = Number((await getCurrentUserInfo(page)).balance);
    expect(afterEnroll).toBeLessThan(initialBalance);

    const firstCancel = await cancelEnrollment(page, eventId);
    expect(firstCancel.success).toBeTruthy();
    const afterFirstCancel = Number((await getCurrentUserInfo(page)).balance);
    expect(afterFirstCancel).toBeCloseTo(initialBalance, 2);

    // Повторная отмена — идемпотентная: без 500 и без повторного возврата.
    const csrf = await page.evaluate(() => {
      const match = document.cookie.match(/csrftoken=([^;]+)/);
      return match ? match[1] : '';
    });
    const response = await page.request.post(`/api/calendar/events/${eventId}/cancel-enrollment/`, {
      data: {},
      headers: { 'X-CSRFToken': csrf },
    });
    expect(response.status()).toBeLessThan(500);
    expect(await response.json()).toHaveProperty('success');

    const afterSecondCancel = Number((await getCurrentUserInfo(page)).balance);
    expect(afterSecondCancel).toBeCloseTo(initialBalance, 2);

    await deleteTestUser(page, phone);
    await clearCookies(page);
    await loginAsAdmin(page);
    await deleteCalendarEvent(page, eventId);
  });

  test('покупка абонемента без средств отклоняется и ничего не создаёт', async ({ page }) => {
    const { phone } = await createFundedUser(page, 0);

    let error = '';
    try {
      await purchaseSubscription(page, TARIFF_GROUP_ID);
    } catch (e) {
      error = String(e);
    }
    expect(error).not.toBe('');

    const info = await getCurrentUserInfo(page);
    expect(info.subscription).toBeNull();
    expect(Number(info.balance)).toBeCloseTo(0, 2);

    await deleteTestUser(page, phone);
  });
});
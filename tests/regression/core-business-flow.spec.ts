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
 * Regression suite — re-checks the CORE money lifecycle end-to-end:
 *
 *   registration → balance funding → subscription purchase →
 *   enrollment (subscription session is spent) → cancellation (session is
 *   refunded) → duplicate-purchase protection → multi-user isolation.
 *
 * These flows are the highest-risk parts of the product, so they are re-run
 * on every release as part of the regression bucket.
 */
test.describe.configure({ mode: 'serial' });

const EVENT_DAY_OFFSET = 369;
const EVENT_DATE = futureDate(EVENT_DAY_OFFSET).slice(0, 10);

let TARIFF_GROUP_ID = 0;
let GROUP_SESSIONS = 0;
let GROUP_SUB_PRICE = 0;

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  try {
    const t = await getResolvedTestTariffs(page);
    TARIFF_GROUP_ID = t.groupId;
    GROUP_SESSIONS = t.groupSessions;
    GROUP_SUB_PRICE = t.groupSubPrice;
  } finally {
    await page.close();
  }
});

/** Fresh registered user with a funded balance, allowed tariff and student session. */
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

/** Creates a class session as admin on the isolated regression date. */
async function createRegressionEvent(page: Page, hour: number): Promise<number> {
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

async function deleteEvent(page: Page, eventId: number): Promise<void> {
  await clearCookies(page);
  await loginAsAdmin(page);
  await deleteCalendarEvent(page, eventId);
}

test.describe('Регрессия — жизненный цикл абонемента и средств', { tag: ['@regression'] }, () => {
  test('покупка абонемента списывает баланс и выдаёт активный абонемент', async ({ page }) => {
    const { phone } = await createFundedUser(page, 20000);

    const before = await getCurrentUserInfo(page);
    expect(Number(before.balance)).toBeCloseTo(20000, 2);
    expect(before.subscription).toBeNull();

    const result = await purchaseSubscription(page, TARIFF_GROUP_ID);
    expect(result.success).toBeTruthy();

    const after = await getCurrentUserInfo(page);
    expect(after.subscription).not.toBeNull();
    expect(after.subscription!.status).toBe('active');
    expect(after.subscription!.sessions_total).toBe(GROUP_SESSIONS);
    expect(after.subscription!.sessions_remaining).toBe(GROUP_SESSIONS);
    expect(Number(after.balance)).toBeCloseTo(20000 - GROUP_SUB_PRICE, 2);

    await deleteTestUser(page, phone);
  });

  test('повторная покупка при активном абонементе безопасно отклоняется', async ({ page }) => {
    const { phone } = await createFundedUser(page, 20000);
    await purchaseSubscription(page, TARIFF_GROUP_ID);

    let error = '';
    try {
      await purchaseSubscription(page, TARIFF_GROUP_ID);
    } catch (e) {
      error = String(e);
    }
    expect(error).not.toBe('');

    // У пользователя остаётся ровно один абонемент, лишних списаний не было.
    const after = await getCurrentUserInfo(page);
    expect(after.subscription!.sessions_total).toBe(GROUP_SESSIONS);
    expect(Number(after.balance)).toBeCloseTo(20000 - GROUP_SUB_PRICE, 2);

    await deleteTestUser(page, phone);
  });

  test('запись на занятие расходует занятие абонемента, отмена возвращает его', async ({ page }) => {
    const eventId = await createRegressionEvent(page, 11);

    const { phone } = await createFundedUser(page, 20000);
    await purchaseSubscription(page, TARIFF_GROUP_ID);

    const initial = await getCurrentUserInfo(page);
    expect(initial.subscription!.sessions_remaining).toBe(GROUP_SESSIONS);

    const enrolled = await enrollToEvent(page, eventId);
    expect(enrolled.success).toBeTruthy();
    const afterEnroll = await getCurrentUserInfo(page);
    expect(afterEnroll.subscription!.sessions_remaining).toBe(GROUP_SESSIONS - 1);

    const cancelled = await cancelEnrollment(page, eventId);
    expect(cancelled.success).toBeTruthy();
    const afterCancel = await getCurrentUserInfo(page);
    expect(afterCancel.subscription!.sessions_remaining).toBe(GROUP_SESSIONS);

    await deleteTestUser(page, phone);
    await deleteEvent(page, eventId);
  });

  test('отмена своей записи не влияет на запись другого студента', async ({ page }) => {
    const eventId = await createRegressionEvent(page, 12);

    const userA = await createFundedUser(page, 5000);
    await enrollToEvent(page, eventId);

    const userB = await createFundedUser(page, 5000);
    await enrollToEvent(page, eventId);

    // Возвращаемся в контекст студента A и отменяем ИМЕННО его запись.
    await clearCookies(page);
    await loginAsStudent(page, userA.phone);
    const cancelled = await cancelEnrollment(page, eventId);
    expect(cancelled.success).toBeTruthy();

    // Запись B остаётся нетронутой.
    const attendance = await page.request.get(`/api/calendar/events/${eventId}/attendance/`);
    const data = await attendance.json();
    const entries = data.attendances as Array<{ client_id: number; status: string }>;
    expect(entries.some((a) => a.client_id === userA.id)).toBe(false);
    expect(entries.some((a) => a.client_id === userB.id)).toBe(true);

    await deleteTestUser(page, userB.phone);
    await deleteTestUser(page, userA.phone);
    await deleteEvent(page, eventId);
  });
});
import { test, expect } from '@playwright/test';
import {
  registerNewUser,
  uniquePhone,
  deleteTestUser,
  getUserInfo,
  loginAsStudent,
  loginAsAdmin,
  clearCookies,
  setAllowedTariffs,
  setBalance,
  purchaseSubscription,
  setSubscriptionRemaining,
  runNotifications,
  getNotifications,
  createCalendarEvent,
  deleteCalendarEvent,
  enrollToEvent,
  futureDate,
  getResolvedTestTariffs,
} from '../../support/fixtures/helpers';

// Уведомления правил 2-4 запускаются глобально над всей БД, поэтому файл обязан
// идти последовательно (serial), чтобы тесты не вмешивались друг в друга.
test.describe.configure({ mode: 'serial' });

let GROUP_ID = 0;

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  try {
    const t = await getResolvedTestTariffs(page);
    GROUP_ID = t.groupId;
  } finally {
    await page.close();
  }
});

async function registerFreshUser(page: Page | import('@playwright/test').Page): Promise<{ phone: string; id: number }> {
  const phone = uniquePhone();
  await registerNewUser(page, phone);
  const info = await getUserInfo(page, phone);
  if (!info.id) throw new Error(`registerFreshUser: id not returned for ${phone}`);
  return { phone, id: info.id };
}

// Пользователь с балансом и allowed-тарифами; в конце входим под ним
async function freshUserWithBalance(page: import('@playwright/test').Page, balance: number): Promise<{ phone: string; id: number }> {
  const { phone, id } = await registerFreshUser(page);
  await clearCookies(page);
  await loginAsAdmin(page);
  await setAllowedTariffs(page, id, [GROUP_ID]);
  await setBalance(page, id, balance);
  await clearCookies(page);
  await loginAsStudent(page, phone);
  return { phone, id };
}

async function createEvent(page: import('@playwright/test').Page, start: string): Promise<number> {
  const ev = await createCalendarEvent(page, {
    class_type_id: 1,
    start,
    duration: 60,
    hall_id: 2,
    tariff_id: GROUP_ID,
    max_participants_override: 20,
  });
  if (!ev.event) throw new Error(`createCalendarEvent: ${JSON.stringify(ev)}`);
  return ev.event.id;
}

function countByMessage(notif: Array<any>, substring: string): number {
  return notif.filter((n) => n.message.includes(substring)).length;
}

test.describe('Плановые уведомления', { tag: ['@functional', '@regression'] }, () => {
  test('правило 2: осталось одно занятие в абонементе — уведомление + дедупликация эпизода', async ({ page }) => {
    const { phone, id } = await freshUserWithBalance(page, 10000);
    try {
      await clearCookies(page);
      await loginAsStudent(page, phone);
      const pur = await purchaseSubscription(page, GROUP_ID);
      expect(pur.success).toBeTruthy();

      await clearCookies(page);
      await loginAsAdmin(page);
      await setSubscriptionRemaining(page, id, 1);
      await clearCookies(page);
      await loginAsStudent(page, phone);

      const res = await runNotifications(page, undefined, id);
      expect(res.success).toBeTruthy();

      const list = (await getNotifications(page)).filter((n) => n.title.includes('Осталось одно занятие'));
      expect(list.length).toBeGreaterThanOrEqual(1);
      expect(list[0].type).toBe('system');

      // Дедупликация: повторный прогон в тот же день не добавляет новое уведомление
      const before = countByMessage(await getNotifications(page), 'Продлите абонемент');
      await runNotifications(page, undefined, id);
      const after = countByMessage(await getNotifications(page), 'Продлите абонемент');
      expect(after).toBe(before);

      // Эпизод открыт: и на следующий день повтор не уходит
      const tomorrow = futureDate(1, { hour: 10, minute: 0 });
      await runNotifications(page, tomorrow, id);
      expect(countByMessage(await getNotifications(page), 'Продлите абонемент')).toBe(before);
    } finally {
      await clearCookies(page);
      await loginAsAdmin(page);
      await deleteTestUser(page, phone);
    }
  });

  test('правило 3: баланс < 1000 ₽ без абонемента — уведомление + дедупликация эпизода', async ({ page }) => {
    const { phone, id } = await freshUserWithBalance(page, 500);
    try {
      await clearCookies(page);
      await loginAsStudent(page, phone);

      const res = await runNotifications(page, undefined, id);
      expect(res.success).toBeTruthy();

      const list = (await getNotifications(page)).filter((n) => n.title.includes('Низкий баланс'));
      expect(list.length).toBeGreaterThanOrEqual(1);
      expect(list[0].type).toBe('balance');

      const before = countByMessage(await getNotifications(page), 'Пополните баланс');
      await runNotifications(page, undefined, id);
      const after = countByMessage(await getNotifications(page), 'Пополните баланс');
      expect(after).toBe(before);
    } finally {
      await clearCookies(page);
      await loginAsAdmin(page);
      await deleteTestUser(page, phone);
    }
  });

  test('правило 3: нет спама — на следующий день повтор не уходит, пока эпизод открыт', async ({ page }) => {
    const { phone, id } = await freshUserWithBalance(page, 500);
    try {
      await clearCookies(page);
      await loginAsStudent(page, phone);

      await runNotifications(page, undefined, id);
      const before = countByMessage(await getNotifications(page), 'Пополните баланс');
      expect(before).toBeGreaterThanOrEqual(1);

      const tomorrow = futureDate(1, { hour: 10, minute: 0 });
      await runNotifications(page, tomorrow, id);
      expect(countByMessage(await getNotifications(page), 'Пополните баланс')).toBe(before);
    } finally {
      await clearCookies(page);
      await loginAsAdmin(page);
      await deleteTestUser(page, phone);
    }
  });

  test('правило 3: после пополнения баланса эпизод сбрасывается — новое падение уведомляет заново', async ({ page }) => {
    const { phone, id } = await freshUserWithBalance(page, 500);
    try {
      await clearCookies(page);
      await loginAsStudent(page, phone);

      await runNotifications(page, undefined, id);
      const first = countByMessage(await getNotifications(page), 'Пополните баланс');
      expect(first).toBeGreaterThanOrEqual(1);

      // Баланс пополнен — пока выше порога, напоминаний нет
      await clearCookies(page);
      await loginAsAdmin(page);
      await setBalance(page, id, 5000);
      await clearCookies(page);
      await loginAsStudent(page, phone);
      await runNotifications(page, undefined, id);
      expect(countByMessage(await getNotifications(page), 'Пополните баланс')).toBe(first);

      // Баланс снова упал — это новый эпизод, уходит ровно одно уведомление
      await clearCookies(page);
      await loginAsAdmin(page);
      await setBalance(page, id, 500);
      await clearCookies(page);
      await loginAsStudent(page, phone);
      await runNotifications(page, undefined, id);
      expect(countByMessage(await getNotifications(page), 'Пополните баланс')).toBe(first + 1);
    } finally {
      await clearCookies(page);
      await loginAsAdmin(page);
      await deleteTestUser(page, phone);
    }
  });

  test('правило 4: напоминание об утреннем занятии за день в 20:00', async ({ page }) => {
    const start = futureDate(1, { hour: 9, minute: 0 });
    const { phone, id } = await freshUserWithBalance(page, 5000);
    let sessionId = 0;
    try {
      await clearCookies(page);
      await loginAsAdmin(page);
      sessionId = await createEvent(page, start);
      await clearCookies(page);
      await loginAsStudent(page, phone);
      await enrollToEvent(page, sessionId);

      // 21:00 сегодня — утреннее занятие завтра уже подлежит напоминанию (20:00 накануне)
      const now = futureDate(0, { hour: 21, minute: 0 });
      const res = await runNotifications(page, now, id);
      expect(res.success).toBeTruthy();

      const mine = (await getNotifications(page)).filter((n) => n.message.includes('09:00'));
      expect(mine.length).toBeGreaterThanOrEqual(1);
      expect(mine[0].type).toBe('reminder');
      expect(mine[0].message).toContain('Завтра');

      // Повторный прогон не дублирует напоминание
      const before = countByMessage(await getNotifications(page), 'Ждём вас');
      await runNotifications(page, now, id);
      const after = countByMessage(await getNotifications(page), 'Ждём вас');
      expect(after).toBe(before);
    } finally {
      await clearCookies(page);
      await loginAsAdmin(page);
      if (sessionId) await deleteCalendarEvent(page, sessionId);
      await deleteTestUser(page, phone);
    }
  });

  test('правило 4: напоминание о дневном занятии в день занятия в 10:00', async ({ page }) => {
    const start = futureDate(1, { hour: 14, minute: 0 });
    const { phone, id } = await freshUserWithBalance(page, 5000);
    let sessionId = 0;
    try {
      await clearCookies(page);
      await loginAsAdmin(page);
      sessionId = await createEvent(page, start);
      await clearCookies(page);
      await loginAsStudent(page, phone);
      await enrollToEvent(page, sessionId);

      // Завтра 11:00 — дневное занятие в 14:00 уже подлежит напоминанию (10:00 в день занятия)
      const now = futureDate(1, { hour: 11, minute: 0 });
      const res = await runNotifications(page, now, id);
      expect(res.success).toBeTruthy();

      const mine = (await getNotifications(page)).filter((n) => n.message.includes('14:00'));
      expect(mine.length).toBeGreaterThanOrEqual(1);
      expect(mine[0].type).toBe('reminder');
      expect(mine[0].message).toContain('Сегодня');
    } finally {
      await clearCookies(page);
      await loginAsAdmin(page);
      if (sessionId) await deleteCalendarEvent(page, sessionId);
      await deleteTestUser(page, phone);
    }
  });

  test('правило 4: напоминание НЕ уходит до наступления целевого окна', async ({ page }) => {
    const start = futureDate(2, { hour: 9, minute: 0 });
    const { phone, id } = await freshUserWithBalance(page, 5000);
    let sessionId = 0;
    try {
      await clearCookies(page);
      await loginAsAdmin(page);
      sessionId = await createEvent(page, start);
      await clearCookies(page);
      await loginAsStudent(page, phone);
      await enrollToEvent(page, sessionId);

      // Сегодня 12:00, занятие послезавтра утром — ночь напоминания (завтра 20:00) ещё не наступила
      const now = futureDate(0, { hour: 12, minute: 0 });
      const res = await runNotifications(page, now, id);
      expect(res.success).toBeTruthy();

      const mine = (await getNotifications(page)).filter((n) => n.message.includes('09:00'));
      expect(mine.length).toBe(0);
    } finally {
      await clearCookies(page);
      await loginAsAdmin(page);
      if (sessionId) await deleteCalendarEvent(page, sessionId);
      await deleteTestUser(page, phone);
    }
  });
});
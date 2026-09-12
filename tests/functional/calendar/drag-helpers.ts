import { Page, expect } from '@playwright/test';
import { CLEAN_EVENT_DATE, CLEAN_EVENT_START } from './helpers';

// Целевой день месяца для drag&drop в месячном виде: тот же месяц, что и
// CLEAN_EVENT_DATE, но отличный от него день.
export const TARGET_DATE = (() => {
  const d = new Date(`${CLEAN_EVENT_DATE}T00:00:00`);
  const day = d.getDate();
  d.setDate(day === 1 ? 2 : 1);
  return d.toISOString().slice(0, 10);
})();

export async function navigateToView(page: Page, view: string): Promise<void> {
  await page.goto('/calendar/');
  await page.evaluate((v) => {
    const cal = (window as any).calendar;
    if (cal && typeof cal.changeView === 'function') cal.changeView(v);
  }, view);
  await page.waitForSelector('.fc-toolbar');
  await page.waitForTimeout(500);
}

// Перетаскивание события вниз в недельном/дневном (timegrid) виде на дату dateStr
export async function dragTimegridLater(
  page: Page,
  event: ReturnType<Page['locator']>,
  dateStr: string,
): Promise<void> {
  const col = page.locator(`.fc-timegrid-col[data-date="${dateStr}"]`);
  const slot = col.locator('.fc-timegrid-slot').last();
  await event.dragTo(slot);
}

// Получить resize-хендл события в timegrid-виде (нижний край). Доступен только
// при eventDurationEditable (персонал). Fallback на всю карточку, если хендл не найден.
export function eventResizeHandle(event: ReturnType<Page['locator']>): ReturnType<Page['locator']> {
  const handle = event.locator('.fc-event-resizer.fc-event-resizer-end, .fc-event-resizer').last();
  return handle;
}

// Сколько resize-хендлов видно у события (0 у студента, ≥1 у персонала).
export async function eventResizeHandleCount(event: ReturnType<Page['locator']>): Promise<number> {
  return event.locator('.fc-event-resizer,.fc-event-resizer-end').count();
}

// Увеличить длительность события в timegrid-виде, потянув нижний хендл вниз.
// addedMinutes — на сколько минут удлинить (слот = 30 мин). Пиксельный шаг
// вычисляется из текущей высоты события и его длительности на фронте.
export async function resizeTimegridLonger(
  page: Page,
  event: ReturnType<Page['locator']>,
  eventId: number,
  addedMinutes: number,
): Promise<void> {
  const handle = eventResizeHandle(event);
  await event.hover();
  await expect(handle).toBeVisible();
  const handleBox = (await handle.boundingBox())!;
  const eventBox = (await event.boundingBox())!;

  const currentDur = await getEventDurationMinutes(page, eventId) ?? 60;
  const pxPerMin = eventBox.height / currentDur;
  const deltaY = Math.round(pxPerMin * addedMinutes);

  const x = handleBox.x + handleBox.width / 2;
  const y = handleBox.y + handleBox.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + deltaY, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(300);
}

// Получить длительность (минуты) события по eventId из календаря на фронте
export async function getEventDurationMinutes(page: Page, eventId: number): Promise<number | null> {
  return page.evaluate((id) => {
    const ev = (window as any).calendar?.getEventById(String(id));
    if (!ev) return null;
    const ms = ev.end ? ev.end.getTime() - ev.start.getTime() : 0;
    return Math.round(ms / 60000);
  }, eventId);
}

// Длительность события по eventId на бэкенде через API
export async function getBackendDurationMinutes(page: Page, eventId: number): Promise<number | null> {
  const events: any[] = await page.evaluate(async () => {
    const r = await fetch('/api/calendar/events/?start=1970-01-01&end=2100-01-01');
    if (!r.ok) throw new Error(`fetch events: HTTP ${r.status}`);
    return r.json();
  });
  const ev = events.find((e: any) => Number(e.id) === eventId);
  if (!ev) return null;
  const d = ev.extendedProps?.duration;
  return typeof d === 'number' ? d : null;
}

// Студент: событие НЕ должно сдвинуться, модалка-предупреждение НЕ показывается
export async function assertForbidden(page: Page, eventId: number): Promise<void> {
  await expect(page.getByTestId('notification-modal')).toBeHidden();
  const start = await page.evaluate((id) => {
    const ev = (window as any).calendar?.getEventById(String(id));
    return ev ? ev.startStr : null;
  }, eventId);
  expect(start).toBe(CLEAN_EVENT_START);
}

// Админ: фронт (calendar.getEventById().startStr) совпадает с бэкендом
export async function assertEventMovedTo(page: Page, eventId: number): Promise<void> {
  const frontendStart = await page.evaluate((id) => {
    const ev = (window as any).calendar?.getEventById(String(id));
    return ev ? ev.startStr : null;
  }, eventId);

  const backendEvents: any[] = await page.evaluate(async () => {
    const r = await fetch('/api/calendar/events/?start=1970-01-01&end=2100-01-01');
    if (!r.ok) throw new Error(`fetch events: HTTP ${r.status}`);
    return r.json();
  });

  const ev = backendEvents.find((e: any) => Number(e.id) === eventId);
  expect(ev).toBeDefined();
  const backendStart = String(ev.start).slice(0, 16);
  expect(frontendStart).toBe(backendStart);
}
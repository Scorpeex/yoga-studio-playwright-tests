import { test, expect } from '@playwright/test';
import { loginAsAdmin, createCalendarEvent, deleteCalendarEvent, cleanupEventsOnDate } from '../../support/fixtures/helpers';
import { CLEAN_EVENT_DATE, CLEAN_EVENT_START } from './helpers';

test.describe('Центровка событий и стабильность высоты строк', { tag: ['@functional', '@regression'] }, () => {
    let eventId: number;

    test('плашки по центру ячейки + строки стабильны при навигации', async ({ page }) => {
        await loginAsAdmin(page);
        await page.goto('/calendar/');
        await page.waitForSelector('.fc-daygrid-day', { timeout: 15000 });
        await cleanupEventsOnDate(page, CLEAN_EVENT_DATE);
        const result = await createCalendarEvent(page, {
            class_type_id: 1,
            start: CLEAN_EVENT_START,
            duration: 60,
            hall_id: 2,
            tariff_id: 3,
            max_participants_override: 10,
        });
        eventId = result.event!.id;

        // Переходим на месяц чистой даты (+1 год от today)
        await page.evaluate((d) => {
            (window as any).calendar?.gotoDate(d);
        }, CLEAN_EVENT_DATE.slice(0, 7) + '-01');
        await page.waitForTimeout(400);

        // ——— 1. Нет скролла страницы (тело заблокировано) ———
        const bodyScrollable = await page.evaluate(
            () => document.body.scrollHeight > document.body.clientHeight + 1,
        );
        console.log('BODY_SCROLLABLE =', bodyScrollable);
        expect(bodyScrollable).toBe(false);

        // ——— 2. Событие отцентрировано в своей ячейке ———
        const centering = await page.evaluate(() => {
            const events = Array.from(document.querySelectorAll('.fc-daygrid-day .fc-event-custom'));
            if (!events.length) return { checked: 0, bad: -1, debug: 'no events' };
            let bad = 0;
            const rows: number[] = [];
            for (const ev of events) {
                const cell = ev.closest('.fc-daygrid-day');
                if (!cell) continue;
                const er = ev.getBoundingClientRect();
                const cr = cell.getBoundingClientRect();
                const off = er.top + er.height / 2 - (cr.top + cr.height / 2);
                if (Math.abs(off) > Math.max(10, cr.height * 0.5)) bad++;
                rows.push(Math.round(cr.height));
            }
            return { checked: events.length, bad, rows: [...new Set(rows)] };
        });
        console.log('CENTERING =', JSON.stringify(centering));
        expect(centering.checked).toBeGreaterThan(0);
        expect(centering.bad).toBe(0);

        // ——— 3. Высоты строк стабильны при навигации по месяцам ———
        const navAbuses: { heights: number[]; scrollable: boolean }[] = [];
        for (const dir of ['.fc-next-button', '.fc-prev-button', '.fc-next-button']) {
            await page.locator(dir).click();
            await page.waitForTimeout(300);
            navAbuses.push(
                await page.evaluate(() => {
                    const heights = Array.from(
                        document.querySelectorAll('.fc-daygrid-body > table > tbody > tr'),
                    ).map((tr) => Math.round(tr.getBoundingClientRect().height));
                    return { heights, scrollable: document.body.scrollHeight > document.body.clientHeight + 1 };
                }),
            );
        }
        for (const ab of navAbuses) {
            console.log('MONTH', JSON.stringify(ab));
            expect(ab.scrollable).toBe(false);
            const maxDiff = Math.max(...ab.heights) - Math.min(...ab.heights);
            expect(maxDiff).toBeLessThanOrEqual(4);
        }

        // ——— 4. Возврат в месяц события + центровка всё ещё работает ———
        await page.evaluate((d) => {
            (window as any).calendar?.gotoDate(d);
        }, CLEAN_EVENT_DATE.slice(0, 7) + '-01');
        await page.waitForTimeout(400);
        const afterNav = await page.evaluate(() => {
            const ev = document.querySelector('.fc-daygrid-day .fc-event-custom');
            if (!ev) return { ok: false };
            const cell = ev.closest('.fc-daygrid-day')!;
            const er = ev.getBoundingClientRect();
            const cr = cell.getBoundingClientRect();
            return { ok: Math.abs(er.top + er.height / 2 - (cr.top + cr.height / 2)) < Math.max(10, cr.height * 0.5) };
        });
        console.log('AFTER_NAV_CENTERED =', JSON.stringify(afterNav));
        expect(afterNav.ok).toBe(true);
    });

    test.afterEach(async ({ page }) => {
        if (eventId) {
            await deleteCalendarEvent(page, eventId);
        }
    });
});
import type { Page } from '@playwright/test';

export interface WidgetLogEntry {
  type: 'new' | 'render' | 'destroy';
  id?: string;
  opts?: {
    confirmation_token?: string;
    return_url?: string;
    error_callback?: (err: unknown) => void;
    [key: string]: unknown;
  };
}

/**
 * Стаб YooKassa-виджета: подменяет window.createPaymentWidget, чтобы
 * не грузился CDN-скрипт. Записи логируются в window.__widgetLog
 * (запись 'new' пушит сам openYooKassaWidget в base.html).
 */
export async function installWidgetStub(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const log: WidgetLogEntry[] = [];
    (window as any).__widgetLog = log;
    (window as any).widgetLog = log;
    (window as any).createPaymentWidget = (_confirmationToken: string, _opts?: unknown) => ({
      render(id: string) {
        log.push({ type: 'render', id });
      },
      destroy() {
        log.push({ type: 'destroy' });
      },
    });
  });
}

export async function getWidgetLog(page: Page): Promise<WidgetLogEntry[]> {
  return page.evaluate(() => (window as any).__widgetLog || []);
}
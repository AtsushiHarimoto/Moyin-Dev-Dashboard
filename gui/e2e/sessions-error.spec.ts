import { test, expect } from '@playwright/test';

/**
 * Sessions 頁面 — API 錯誤情境 E2E 測試
 * 攔截 /api/* 路由，注入各種錯誤回應，驗證 UI 不白屏
 */

// 嚴格模式：收集未被明確 mock 的 API 路由，afterEach 斷言為空
let unmockedRoutes: string[] = [];

test.beforeEach(async ({ page }) => {
  unmockedRoutes = [];
  // 最低優先級 catch-all — 任何穿透到這裡的請求都是漏 mock
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url()).pathname;
    unmockedRoutes.push(`${route.request().method()} ${url}`);
    route.abort('failed');
  });
});

test.afterEach(() => {
  expect(unmockedRoutes, `未 mock 的 API 路由被呼叫: ${unmockedRoutes.join(', ')}`).toEqual([]);
});

/** Mock 全局背景路由（Sidebar 的 reports badge、SSE、wiki 等） */
async function mockGlobalRoutes(page: import('@playwright/test').Page) {
  await page.route('**/api/reports**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
  );
  await page.route('**/api/analysis/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/event-stream', body: '' })
  );
  await page.route('**/api/wiki/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
  );
  await page.route('**/api/dashboard/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) })
  );
  await page.route('**/api/email/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { configured: false, from: '', to: '' } }) })
  );
}

/** Skills 頁面是預設頁面，切到 Sessions 前會發 skills 相關請求 */
async function mockSkillsEmpty(page: import('@playwright/test').Page) {
  await page.route('**/api/skills/profiles', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
  );
  await page.route('**/api/skills/categories', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
  );
  await page.route('**/api/skills', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
  );
}

test.describe('Sessions — API 回傳 500 HTML（非 JSON）', () => {
  test('頁面不白屏，不拋未捕獲異常', async ({ page }) => {
    // 覆蓋 catch-all：所有 /api/ 回傳 HTML 500（這是本測試的意圖）
    await page.route('**/api/**', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'text/html',
        body: '<html><body>Internal Server Error</body></html>',
      })
    );

    await page.goto('/');
    await page.click('button:has-text("會話歷史")');

    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page.locator('.main-content')).toBeVisible();

    const bodyText = await page.locator('body').textContent();
    expect(bodyText!.length).toBeGreaterThan(0);

    const crashed = await page.evaluate(() => document.querySelector('#root')?.childElementCount === 0);
    expect(crashed).toBe(false);

    // 這個測試明確 mock 了所有路由，清空 unmocked 記錄
    unmockedRoutes = [];
  });
});

test.describe('Sessions — API 回傳 500 JSON { success: false }', () => {
  test('頁面不白屏，顯示 loading 或空狀態', async ({ page }) => {
    await mockGlobalRoutes(page);
    await mockSkillsEmpty(page);

    await page.route('**/api/sessions/stats/summary*', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'stats error' }),
      })
    );
    await page.route('**/api/sessions*', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: '資料庫連線失敗' }),
      })
    );

    await page.goto('/');
    await page.click('button:has-text("會話歷史")');

    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page.locator('.main-content')).toBeVisible();

    const crashed = await page.evaluate(() => document.querySelector('#root')?.childElementCount === 0);
    expect(crashed).toBe(false);
  });
});

test.describe('Sessions — API 回傳 502 Bad Gateway', () => {
  test('頁面不白屏', async ({ page }) => {
    await page.route('**/api/**', (route) =>
      route.fulfill({
        status: 502,
        contentType: 'text/html',
        body: '<html><body>502 Bad Gateway</body></html>',
      })
    );

    await page.goto('/');
    await page.click('button:has-text("會話歷史")');

    await expect(page.locator('.sidebar')).toBeVisible();
    const crashed = await page.evaluate(() => document.querySelector('#root')?.childElementCount === 0);
    expect(crashed).toBe(false);

    unmockedRoutes = [];
  });
});

test.describe('Sessions — Happy path（mock 正常資料）', () => {
  test('正常渲染 session 列表', async ({ page }) => {
    await mockGlobalRoutes(page);
    await mockSkillsEmpty(page);

    const mockSessions = [
      {
        sessionId: 'test-001',
        projectPath: '/projects/test',
        gitBranch: 'main',
        customTitle: 'Test Session',
        summary: 'A test session for E2E',
        firstPrompt: 'Hello',
        messageCount: 5,
        createdAt: '2026-02-10T10:00:00Z',
        modifiedAt: '2026-02-10T11:00:00Z',
        fileMtime: 1000,
        fullPath: '/tmp/test.jsonl',
        isSidechain: false,
      },
    ];

    await page.route('**/api/sessions/stats/summary*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { totalSessions: 1, totalMessages: 5, totalUserMessages: 3, projects: ['/projects/test'], branches: ['main'] },
        }),
      })
    );
    await page.route('**/api/sessions*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockSessions }),
      })
    );

    await page.goto('/');
    await page.click('button:has-text("會話歷史")');

    await expect(page.locator('text=會話詳情')).toBeVisible();
    await expect(page.locator('text=Test Session')).toBeVisible({ timeout: 5000 });
  });
});

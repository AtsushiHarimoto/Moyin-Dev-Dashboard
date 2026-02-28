import { test, expect } from '@playwright/test';

/**
 * Skills 頁面 — API 錯誤情境 E2E 測試
 * 攔截 /api/skills/* 路由，注入各種錯誤回應，驗證 UI 不白屏
 */

// 嚴格模式：收集未被明確 mock 的 API 路由，afterEach 斷言為空
let unmockedRoutes: string[] = [];

test.beforeEach(async ({ page }) => {
  unmockedRoutes = [];
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

test.describe('Skills — API 回傳 500 HTML（非 JSON）', () => {
  test('頁面不白屏，不拋未捕獲異常', async ({ page }) => {
    await mockGlobalRoutes(page);

    const html500 = { status: 500, contentType: 'text/html', body: '<html><body>Internal Server Error</body></html>' };
    await page.route('**/api/skills/**', (route) => route.fulfill(html500));
    await page.route('**/api/skills', (route) => route.fulfill(html500));

    await page.goto('/');

    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page.locator('.main-content')).toBeVisible();

    const crashed = await page.evaluate(() => document.querySelector('#root')?.childElementCount === 0);
    expect(crashed).toBe(false);
  });
});

test.describe('Skills — API 回傳 500 JSON { success: false }', () => {
  test('頁面不白屏', async ({ page }) => {
    await mockGlobalRoutes(page);

    await page.route('**/api/skills/profiles', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'profiles error' }) })
    );
    await page.route('**/api/skills/categories', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'categories error' }) })
    );
    await page.route('**/api/skills', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'skills DB 連線失敗' }) })
    );

    await page.goto('/');

    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page.locator('.main-content')).toBeVisible();

    const crashed = await page.evaluate(() => document.querySelector('#root')?.childElementCount === 0);
    expect(crashed).toBe(false);
  });
});

test.describe('Skills — 部分 API 失敗，部分成功', () => {
  test('profiles 成功但 skills 失敗，頁面仍可用', async ({ page }) => {
    await mockGlobalRoutes(page);

    // profile 詳情（自動選中第一個 profile 後會請求）
    await page.route('**/api/skills/profiles/cc-dev', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { name: 'cc-dev', description: 'Dev profile', skills: ['a'] } }),
      })
    );
    await page.route('**/api/skills/profiles', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [{ name: 'cc-dev', description: 'Dev profile', skillCount: 3 }] }),
      })
    );
    await page.route('**/api/skills/categories', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: ['general', 'frontend'] }),
      })
    );
    // skills 清單失敗
    await page.route('**/api/skills', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'skills unavailable' }),
      })
    );

    await page.goto('/');

    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page.locator('text=Skill Matrix 矩陣配置')).toBeVisible();
    await expect(page.locator('text=cc-dev')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Skills — Happy path（mock 正常資料）', () => {
  test('正常渲染 skills 列表與 profiles', async ({ page }) => {
    await mockGlobalRoutes(page);

    const mockSkills = [
      { name: 'test-skill', description: 'A test skill', category: 'general', path: '/skills/test' },
      { name: 'frontend-skill', description: 'Frontend skill', category: 'frontend', path: '/skills/frontend' },
    ];

    await page.route('**/api/skills/profiles/cc-dev', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { name: 'cc-dev', description: 'Development', skills: ['test-skill'] } }),
      })
    );
    await page.route('**/api/skills/profiles', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [{ name: 'cc-dev', description: 'Development', skillCount: 1 }] }),
      })
    );
    await page.route('**/api/skills/categories', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: ['general', 'frontend'] }),
      })
    );
    await page.route('**/api/skills', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockSkills }),
      })
    );

    await page.goto('/');

    await expect(page.locator('text=Skill Matrix 矩陣配置')).toBeVisible();
    await expect(page.locator('text=cc-dev')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=test-skill')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=frontend-skill')).toBeVisible({ timeout: 5000 });
  });
});

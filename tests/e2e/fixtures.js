/**
 * Playwright E2Eテスト用フィクスチャ
 */

const { test: base, chromium } = require('@playwright/test');
const path = require('path');

// カスタムフィクスチャを定義
exports.test = base.extend({
  // Chrome拡張機能を読み込んだコンテキスト
  extensionContext: async ({}, use) => {
    const pathToExtension = path.join(__dirname, '../..');
    
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox'
      ],
    });
    
    await use(context);
    await context.close();
  },
  
  // 拡張機能のページ
  extensionPage: async ({ extensionContext }, use) => {
    // 拡張機能のIDを取得
    let [background] = extensionContext.serviceWorkers();
    if (!background) {
      background = await extensionContext.waitForEvent('serviceworker');
    }
    const extensionId = background.url().split('/')[2];
    
    // ポップアップページを開く
    const page = await extensionContext.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    
    await use(page);
  },
  
  // Googleカレンダーのモックページ
  calendarPage: async ({ extensionContext }, use) => {
    const page = await extensionContext.newPage();
    
    // モックHTMLを設定
    await page.route('https://calendar.google.com/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Google Calendar - Mock</title>
          </head>
          <body>
            <div id="calendar-container">
              <h1>Google Calendar (Mock)</h1>
              
              <!-- マイカレンダー -->
              <div role="heading" aria-label="マイカレンダー">マイカレンダー</div>
              <div>
                <input type="checkbox" aria-label="自分のカレンダー" checked>
                <span>自分のカレンダー</span>
              </div>
              
              <!-- 他のカレンダー -->
              <div role="heading" aria-label="他のカレンダー">他のカレンダー</div>
              <div>
                <input type="checkbox" aria-label="山田太郎" checked>
                <span>山田太郎</span>
              </div>
              <div>
                <input type="checkbox" aria-label="鈴木花子" checked>
                <span>鈴木花子</span>
              </div>
              <div>
                <input type="checkbox" aria-label="佐藤次郎">
                <span>佐藤次郎</span>
              </div>
              <div>
                <input type="checkbox" aria-label="田中一郎">
                <span>田中一郎</span>
              </div>
            </div>
          </body>
          </html>
        `
      });
    });
    
    await page.goto('https://calendar.google.com/');
    await use(page);
  }
});

exports.expect = base.expect;

// ヘルパー関数
exports.helpers = {
  // グループを作成
  async createGroup(page, name, members) {
    await page.fill('#groupName', name);
    await page.fill('#memberInput', members.join('\n'));
    await page.click('#createGroup');
    await page.waitForSelector('.message.success');
  },
  
  // メッセージが表示されるまで待機
  async waitForMessage(page, type = 'success') {
    await page.waitForSelector(`.message.${type}`, { state: 'visible' });
  },
  
  // グループが存在することを確認
  async expectGroupExists(page, groupName) {
    await page.waitForSelector(`.group-name:has-text("${groupName}")`);
  },
  
  // グループを適用
  async applyGroup(page, groupName) {
    const groupItem = page.locator('.group-item', { hasText: groupName });
    await groupItem.locator('.apply-btn').click();
  },
  
  // カレンダーのチェック状態を確認
  async expectCalendarChecked(calendarPage, calendarName, checked = true) {
    const checkbox = calendarPage.locator(`input[type="checkbox"][aria-label="${calendarName}"]`);
    if (checked) {
      await expect(checkbox).toBeChecked();
    } else {
      await expect(checkbox).not.toBeChecked();
    }
  }
};
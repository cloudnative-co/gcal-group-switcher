/**
 * Playwright設定ファイル
 */

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  // テストディレクトリ
  testDir: './tests/e2e',
  
  // タイムアウト設定
  timeout: 30 * 1000,
  expect: {
    timeout: 5000
  },
  
  // 並列実行設定
  fullyParallel: true,
  workers: process.env.CI ? 1 : undefined,
  
  // リトライ設定
  retries: process.env.CI ? 2 : 0,
  
  // レポート設定
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list']
  ],
  
  // グローバル設定
  use: {
    // ベースURL（ローカルサーバーを使用する場合）
    baseURL: 'http://localhost:3000',
    
    // トレース設定
    trace: 'on-first-retry',
    
    // スクリーンショット設定
    screenshot: 'only-on-failure',
    
    // ビデオ設定
    video: 'retain-on-failure',
    
    // アクションのタイムアウト
    actionTimeout: 10000,
    
    // ナビゲーションのタイムアウト
    navigationTimeout: 30000,
  },
  
  // プロジェクト設定（ブラウザごと）
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Chrome拡張機能のテスト用設定
        launchOptions: {
          args: [
            `--disable-extensions-except=${__dirname}`,
            `--load-extension=${__dirname}`,
            '--no-sandbox'
          ],
        },
        // 拡張機能のコンテキスト設定
        contextOptions: {
          // Chrome拡張機能を有効化
          permissions: ['clipboard-read', 'clipboard-write'],
        }
      },
    },
    
    // 必要に応じて他のブラウザも追加
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],
  
  // Webサーバー設定（必要な場合）
  webServer: process.env.CI ? undefined : {
    command: 'npm run serve-extension',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
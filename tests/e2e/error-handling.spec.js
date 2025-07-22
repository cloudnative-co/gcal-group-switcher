/**
 * エラーハンドリングのE2Eテスト
 */

const { test, expect, helpers } = require('./fixtures');

test.describe('エラーハンドリング', () => {
  test('ネットワークエラーの処理', async ({ extensionPage, context }) => {
    // ネットワークを切断
    await context.route('**/*', route => route.abort());
    
    // グループを作成しようとする
    await extensionPage.fill('#groupName', 'テストグループ');
    await extensionPage.fill('#memberInput', 'メンバー1');
    await extensionPage.click('#createGroup');
    
    // エラーメッセージを確認
    await helpers.waitForMessage(extensionPage, 'error');
    const message = await extensionPage.locator('.message.error').textContent();
    expect(message).toContain('ネットワークエラーが発生しました');
    
    // リトライボタンが表示される
    const retryButton = await extensionPage.locator('.error-action:has-text("再試行")');
    await expect(retryButton).toBeVisible();
  });

  test('ストレージ容量超過エラー', async ({ extensionPage }) => {
    // Chrome Storage APIをモックして容量超過をシミュレート
    await extensionPage.evaluate(() => {
      const originalSet = chrome.storage.local.set;
      chrome.storage.local.set = (data, callback) => {
        const error = new Error('QUOTA_BYTES quota exceeded');
        error.name = 'QuotaExceededError';
        if (callback) callback();
        chrome.runtime.lastError = { message: error.message };
        throw error;
      };
    });
    
    // グループを作成しようとする
    await extensionPage.fill('#groupName', '容量テスト');
    await extensionPage.fill('#memberInput', 'メンバー1');
    await extensionPage.click('#createGroup');
    
    // エラーメッセージを確認
    await helpers.waitForMessage(extensionPage, 'error');
    const message = await extensionPage.locator('.message.error').textContent();
    expect(message).toContain('ストレージの容量が不足しています');
  });

  test('バリデーションエラーの表示', async ({ extensionPage }) => {
    // 無効な文字を含むグループ名
    await extensionPage.fill('#groupName', '<script>alert("test")</script>');
    await extensionPage.fill('#memberInput', 'メンバー1');
    await extensionPage.click('#createGroup');
    
    // エラーメッセージを確認
    await helpers.waitForMessage(extensionPage, 'error');
    const message = await extensionPage.locator('.message.error').textContent();
    expect(message).toContain('無効な文字が含まれています');
  });

  test('同時操作によるエラー', async ({ extensionPage }) => {
    // グループを作成
    await helpers.createGroup(extensionPage, '同時操作テスト', ['メンバー1']);
    
    // 2つの削除操作を同時に実行
    const groupItem = extensionPage.locator('.group-item', { hasText: '同時操作テスト' });
    const deleteBtn = groupItem.locator('.delete-btn');
    
    // ダイアログを自動で承認
    extensionPage.on('dialog', dialog => dialog.accept());
    
    // 同時に2回削除をクリック
    await Promise.all([
      deleteBtn.click(),
      deleteBtn.click()
    ]);
    
    // 最初の削除は成功、2回目はエラー
    await helpers.waitForMessage(extensionPage, 'error');
    const message = await extensionPage.locator('.message.error').textContent();
    expect(message).toContain('操作を完了できませんでした');
  });

  test('DOM構造変更エラー', async ({ extensionPage, calendarPage }) => {
    // カレンダーページのDOM構造を変更
    await calendarPage.evaluate(() => {
      // チェックボックスを全て削除
      document.querySelectorAll('input[type="checkbox"]').forEach(el => el.remove());
    });
    
    // グループを適用しようとする
    await extensionPage.bringToFront();
    await helpers.applyGroup(extensionPage, 'チームA');
    
    // エラーメッセージを確認
    await helpers.waitForMessage(extensionPage, 'error');
    const message = await extensionPage.locator('.message.error').textContent();
    expect(message).toContain('ページの構造が変更されています');
    
    // リロードボタンが表示される
    const reloadButton = extensionPage.locator('.error-action:has-text("ページをリロード")');
    await expect(reloadButton).toBeVisible();
  });

  test('エラーメッセージの自動非表示', async ({ extensionPage }) => {
    // エラーを発生させる（グループ名なし）
    await extensionPage.click('#createGroup');
    
    // エラーメッセージが表示される
    const errorMessage = extensionPage.locator('.message.error');
    await expect(errorMessage).toBeVisible();
    
    // 5秒後に自動的に非表示になる
    await extensionPage.waitForTimeout(5500);
    await expect(errorMessage).toBeHidden();
  });

  test('エラー後のリトライ機能', async ({ extensionPage, context }) => {
    let requestCount = 0;
    
    // 最初の2回は失敗、3回目で成功するようにモック
    await context.route('**/chrome.storage.local.set', route => {
      requestCount++;
      if (requestCount < 3) {
        route.abort('failed');
      } else {
        route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
      }
    });
    
    // グループを作成
    await extensionPage.fill('#groupName', 'リトライテスト');
    await extensionPage.fill('#memberInput', 'メンバー1');
    await extensionPage.click('#createGroup');
    
    // リトライが成功してグループが作成される
    await helpers.waitForMessage(extensionPage, 'success');
    await helpers.expectGroupExists(extensionPage, 'リトライテスト');
  });

  test('デバッグ情報の表示', async ({ extensionPage }) => {
    // デバッグモードを有効化
    await extensionPage.evaluate(() => {
      localStorage.setItem('debug', 'true');
    });
    await extensionPage.reload();
    
    // エラーを発生させる
    await extensionPage.click('#createGroup');
    
    // エラーメッセージにデバッグ情報が含まれる
    const errorMessage = extensionPage.locator('.message.error');
    await expect(errorMessage).toBeVisible();
    
    // デバッグ情報ボタンをクリック
    const debugButton = errorMessage.locator('.debug-info-btn');
    await expect(debugButton).toBeVisible();
    await debugButton.click();
    
    // デバッグ情報が表示される
    const debugInfo = extensionPage.locator('.debug-info');
    await expect(debugInfo).toBeVisible();
    await expect(debugInfo).toContainText('ErrorType:');
    await expect(debugInfo).toContainText('Timestamp:');
    await expect(debugInfo).toContainText('Stack:');
  });
});
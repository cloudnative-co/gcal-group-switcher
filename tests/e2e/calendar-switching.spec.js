/**
 * カレンダー切り替え機能のE2Eテスト
 */

const { test, expect, helpers } = require('./fixtures');

test.describe('カレンダー切り替え機能', () => {
  test.beforeEach(async ({ extensionPage }) => {
    // テスト用のグループを事前に作成
    await helpers.createGroup(extensionPage, 'チームA', ['山田太郎', '鈴木花子']);
    await helpers.createGroup(extensionPage, 'チームB', ['佐藤次郎', '田中一郎']);
  });

  test('グループを適用してカレンダーを切り替える', async ({ extensionPage, calendarPage }) => {
    // Googleカレンダーページに移動
    await calendarPage.bringToFront();
    
    // 初期状態を確認（全てのカレンダーがチェックされている）
    await helpers.expectCalendarChecked(calendarPage, '山田太郎', true);
    await helpers.expectCalendarChecked(calendarPage, '鈴木花子', true);
    await helpers.expectCalendarChecked(calendarPage, '佐藤次郎', false);
    await helpers.expectCalendarChecked(calendarPage, '田中一郎', false);
    
    // 拡張機能に戻る
    await extensionPage.bringToFront();
    
    // チームBを適用
    await helpers.applyGroup(extensionPage, 'チームB');
    
    // 成功メッセージを確認
    await helpers.waitForMessage(extensionPage, 'success');
    const message = await extensionPage.locator('.message.success').textContent();
    expect(message).toContain('グループを適用しました');
    
    // カレンダーページで変更を確認
    await calendarPage.bringToFront();
    await calendarPage.waitForTimeout(500); // DOM更新を待つ
    
    // チームBのメンバーのみチェックされている
    await helpers.expectCalendarChecked(calendarPage, '山田太郎', false);
    await helpers.expectCalendarChecked(calendarPage, '鈴木花子', false);
    await helpers.expectCalendarChecked(calendarPage, '佐藤次郎', true);
    await helpers.expectCalendarChecked(calendarPage, '田中一郎', true);
  });

  test('「自分のカレンダーのみ」機能', async ({ extensionPage, calendarPage }) => {
    // Googleカレンダーページに移動
    await calendarPage.bringToFront();
    
    // 他のカレンダーもチェックされている状態を確認
    await helpers.expectCalendarChecked(calendarPage, '山田太郎', true);
    await helpers.expectCalendarChecked(calendarPage, '鈴木花子', true);
    
    // 拡張機能に戻る
    await extensionPage.bringToFront();
    
    // 「自分のカレンダーのみ」ボタンをクリック
    await extensionPage.click('#showMyCalendarOnly');
    
    // 成功メッセージを確認
    await helpers.waitForMessage(extensionPage, 'success');
    
    // カレンダーページで変更を確認
    await calendarPage.bringToFront();
    await calendarPage.waitForTimeout(500);
    
    // 自分のカレンダーのみチェックされている
    await helpers.expectCalendarChecked(calendarPage, '自分のカレンダー', true);
    await helpers.expectCalendarChecked(calendarPage, '山田太郎', false);
    await helpers.expectCalendarChecked(calendarPage, '鈴木花子', false);
    await helpers.expectCalendarChecked(calendarPage, '佐藤次郎', false);
    await helpers.expectCalendarChecked(calendarPage, '田中一郎', false);
  });

  test('カレンダー候補の自動補完', async ({ extensionPage }) => {
    // メンバー入力フィールドに文字を入力
    const memberInput = extensionPage.locator('#memberInput');
    await memberInput.type('山田');
    
    // 自動補完リストが表示される
    const suggestions = extensionPage.locator('.autocomplete-suggestions');
    await expect(suggestions).toBeVisible();
    
    // 候補が表示される
    const suggestionItems = suggestions.locator('.suggestion-item');
    await expect(suggestionItems).toHaveCount(1); // モックデータでは「山田太郎」のみ
    await expect(suggestionItems.first()).toContainText('山田太郎');
    
    // 候補をクリックして選択
    await suggestionItems.first().click();
    
    // 入力フィールドに反映される
    const inputValue = await memberInput.inputValue();
    expect(inputValue).toContain('山田太郎');
    
    // 自動補完リストが閉じる
    await expect(suggestions).toBeHidden();
  });

  test('タブが見つからない場合のエラー処理', async ({ extensionPage }) => {
    // Googleカレンダータブを閉じる
    const pages = extensionPage.context().pages();
    const calendarPage = pages.find(p => p.url().includes('calendar.google.com'));
    if (calendarPage) {
      await calendarPage.close();
    }
    
    // グループを適用しようとする
    await helpers.applyGroup(extensionPage, 'チームA');
    
    // エラーメッセージを確認
    await helpers.waitForMessage(extensionPage, 'error');
    const message = await extensionPage.locator('.message.error').textContent();
    expect(message).toContain('Googleカレンダーのタブが見つかりません');
    
    // アクションボタンが表示される
    const actionButton = extensionPage.locator('.error-action');
    await expect(actionButton).toBeVisible();
    await expect(actionButton).toContainText('カレンダーを開く');
  });

  test('複数のグループを連続で適用', async ({ extensionPage, calendarPage }) => {
    // チームAを適用
    await helpers.applyGroup(extensionPage, 'チームA');
    await helpers.waitForMessage(extensionPage, 'success');
    
    // カレンダーページで確認
    await calendarPage.bringToFront();
    await calendarPage.waitForTimeout(500);
    await helpers.expectCalendarChecked(calendarPage, '山田太郎', true);
    await helpers.expectCalendarChecked(calendarPage, '鈴木花子', true);
    await helpers.expectCalendarChecked(calendarPage, '佐藤次郎', false);
    await helpers.expectCalendarChecked(calendarPage, '田中一郎', false);
    
    // 拡張機能に戻ってチームBを適用
    await extensionPage.bringToFront();
    await helpers.applyGroup(extensionPage, 'チームB');
    await helpers.waitForMessage(extensionPage, 'success');
    
    // カレンダーページで変更を確認
    await calendarPage.bringToFront();
    await calendarPage.waitForTimeout(500);
    await helpers.expectCalendarChecked(calendarPage, '山田太郎', false);
    await helpers.expectCalendarChecked(calendarPage, '鈴木花子', false);
    await helpers.expectCalendarChecked(calendarPage, '佐藤次郎', true);
    await helpers.expectCalendarChecked(calendarPage, '田中一郎', true);
  });

  test('大量のメンバーを含むグループの処理', async ({ extensionPage, calendarPage }) => {
    // 大量のメンバーを含むグループを作成
    const manyMembers = Array.from({ length: 50 }, (_, i) => `メンバー${i + 1}`);
    await extensionPage.fill('#groupName', '大規模チーム');
    await extensionPage.fill('#memberInput', manyMembers.join('\n'));
    await extensionPage.click('#createGroup');
    
    // 作成成功を確認
    await helpers.waitForMessage(extensionPage, 'success');
    
    // グループが仮想スクロールで表示される（20件以上の場合）
    const groupItem = extensionPage.locator('.group-item', { hasText: '大規模チーム' });
    await groupItem.locator('.expand-btn').click();
    
    // メンバーリストコンテナの高さが制限されている
    const membersList = groupItem.locator('.members-list');
    const height = await membersList.evaluate(el => el.offsetHeight);
    expect(height).toBeLessThanOrEqual(400); // 仮想スクロールの最大高さ
    
    // スクロール可能であることを確認
    const scrollHeight = await membersList.evaluate(el => el.scrollHeight);
    expect(scrollHeight).toBeGreaterThan(height);
  });
});
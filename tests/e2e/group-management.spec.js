/**
 * グループ管理機能のE2Eテスト
 */

const { test, expect, helpers } = require('./fixtures');

test.describe('グループ管理機能', () => {
  test('新しいグループを作成', async ({ extensionPage }) => {
    // グループ名とメンバーを入力
    await extensionPage.fill('#groupName', 'テストグループ');
    await extensionPage.fill('#memberInput', '山田太郎\n鈴木花子\n佐藤次郎');
    
    // グループを作成
    await extensionPage.click('#createGroup');
    
    // 成功メッセージを確認
    await helpers.waitForMessage(extensionPage, 'success');
    const message = await extensionPage.locator('.message.success').textContent();
    expect(message).toContain('グループを作成しました');
    
    // グループがリストに追加されたことを確認
    await helpers.expectGroupExists(extensionPage, 'テストグループ');
    
    // メンバー数が正しく表示されることを確認
    const groupItem = extensionPage.locator('.group-item', { hasText: 'テストグループ' });
    const memberCount = await groupItem.locator('.member-count').textContent();
    expect(memberCount).toBe('3人');
  });

  test('グループ名が空の場合はエラー', async ({ extensionPage }) => {
    // メンバーのみ入力（グループ名は空）
    await extensionPage.fill('#memberInput', '山田太郎');
    
    // グループ作成を試行
    await extensionPage.click('#createGroup');
    
    // エラーメッセージを確認
    await helpers.waitForMessage(extensionPage, 'error');
    const message = await extensionPage.locator('.message.error').textContent();
    expect(message).toContain('グループ名を入力してください');
  });

  test('メンバーが空の場合はエラー', async ({ extensionPage }) => {
    // グループ名のみ入力（メンバーは空）
    await extensionPage.fill('#groupName', 'テストグループ');
    
    // グループ作成を試行
    await extensionPage.click('#createGroup');
    
    // エラーメッセージを確認
    await helpers.waitForMessage(extensionPage, 'error');
    const message = await extensionPage.locator('.message.error').textContent();
    expect(message).toContain('メンバーを入力してください');
  });

  test('重複するグループ名はエラー', async ({ extensionPage }) => {
    // 最初のグループを作成
    await helpers.createGroup(extensionPage, '重複テスト', ['メンバー1']);
    
    // 同じ名前で2つ目のグループを作成しようとする
    await extensionPage.fill('#groupName', '重複テスト');
    await extensionPage.fill('#memberInput', 'メンバー2');
    await extensionPage.click('#createGroup');
    
    // エラーメッセージを確認
    await helpers.waitForMessage(extensionPage, 'error');
    const message = await extensionPage.locator('.message.error').textContent();
    expect(message).toContain('同じ名前のグループが既に存在します');
  });

  test('グループの展開と折りたたみ', async ({ extensionPage }) => {
    // グループを作成
    await helpers.createGroup(extensionPage, '展開テスト', ['メンバー1', 'メンバー2']);
    
    // グループアイテムを取得
    const groupItem = extensionPage.locator('.group-item', { hasText: '展開テスト' });
    const expandBtn = groupItem.locator('.expand-btn');
    const membersList = groupItem.locator('.members-list');
    
    // 初期状態では折りたたまれている
    await expect(membersList).toBeHidden();
    await expect(expandBtn).toHaveText('▶');
    
    // 展開ボタンをクリック
    await expandBtn.click();
    
    // メンバーリストが表示される
    await expect(membersList).toBeVisible();
    await expect(expandBtn).toHaveText('▼');
    
    // メンバーが正しく表示される
    const members = await membersList.locator('.member-item').allTextContents();
    expect(members).toEqual(['メンバー1', 'メンバー2']);
    
    // 再度クリックで折りたたむ
    await expandBtn.click();
    await expect(membersList).toBeHidden();
    await expect(expandBtn).toHaveText('▶');
  });

  test('グループの削除', async ({ extensionPage }) => {
    // グループを作成
    await helpers.createGroup(extensionPage, '削除テスト', ['メンバー1']);
    
    // グループアイテムを取得
    const groupItem = extensionPage.locator('.group-item', { hasText: '削除テスト' });
    
    // 削除ボタンをクリック
    await groupItem.locator('.delete-btn').click();
    
    // 確認ダイアログでOKをクリック
    extensionPage.on('dialog', dialog => dialog.accept());
    
    // グループが削除されたことを確認
    await expect(groupItem).toBeHidden();
  });

  test('グループの編集', async ({ extensionPage }) => {
    // グループを作成
    await helpers.createGroup(extensionPage, '編集前', ['メンバー1']);
    
    // グループアイテムを取得
    const groupItem = extensionPage.locator('.group-item', { hasText: '編集前' });
    
    // 編集ボタンをクリック
    await groupItem.locator('.edit-btn').click();
    
    // 編集フォームが表示される
    const editForm = groupItem.locator('.edit-form');
    await expect(editForm).toBeVisible();
    
    // グループ名とメンバーを変更
    await editForm.locator('input[type="text"]').fill('編集後');
    await editForm.locator('textarea').fill('新メンバー1\n新メンバー2');
    
    // 保存ボタンをクリック
    await editForm.locator('.save-btn').click();
    
    // 変更が反映されたことを確認
    await helpers.expectGroupExists(extensionPage, '編集後');
    const updatedItem = extensionPage.locator('.group-item', { hasText: '編集後' });
    const memberCount = await updatedItem.locator('.member-count').textContent();
    expect(memberCount).toBe('2人');
  });

  test('グループの並び替え（ドラッグ&ドロップ）', async ({ extensionPage }) => {
    // 3つのグループを作成
    await helpers.createGroup(extensionPage, 'グループA', ['メンバーA']);
    await helpers.createGroup(extensionPage, 'グループB', ['メンバーB']);
    await helpers.createGroup(extensionPage, 'グループC', ['メンバーC']);
    
    // グループアイテムを取得
    const groupA = extensionPage.locator('.group-item', { hasText: 'グループA' });
    const groupC = extensionPage.locator('.group-item', { hasText: 'グループC' });
    
    // グループAをグループCの下にドラッグ
    await groupA.dragTo(groupC, {
      targetPosition: { x: 10, y: 50 } // グループCの下側
    });
    
    // 順序が変更されたことを確認
    const groupNames = await extensionPage.locator('.group-name').allTextContents();
    expect(groupNames).toEqual(['グループB', 'グループC', 'グループA']);
  });

  test('空の状態でのメッセージ表示', async ({ extensionPage }) => {
    // グループリストが空であることを確認
    const emptyMessage = extensionPage.locator('.empty-state');
    await expect(emptyMessage).toBeVisible();
    await expect(emptyMessage).toContainText('グループがありません');
    await expect(emptyMessage).toContainText('新しいグループを作成してください');
  });
});
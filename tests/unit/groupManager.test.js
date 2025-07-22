/**
 * GroupManager の単体テスト
 */

// モジュールを読み込む前にグローバルを設定
global.ErrorHandler = {
  wrapChromeApi: jest.fn((fn) => fn()),
  validationError: jest.fn((type, details) => new Error(`Validation error: ${type}`)),
  logError: jest.fn()
};

// テスト対象をrequireで読み込む（import文の前にグローバル設定が必要なため）
const fs = require('fs');
const path = require('path');
const groupManagerCode = fs.readFileSync(
  path.join(__dirname, '../../groupManager.js'),
  'utf8'
);

// グローバルスコープで実行
eval(groupManagerCode);

describe('GroupManager', () => {
  let manager;

  beforeEach(() => {
    manager = new GroupManager();
    TestUtils.setStorageData({});
  });

  describe('loadGroups', () => {
    test('ストレージからグループを正常に読み込む', async () => {
      const mockGroups = [
        { name: 'テストグループ1', members: ['メンバー1', 'メンバー2'] },
        { name: 'テストグループ2', members: ['メンバー3'] }
      ];
      
      TestUtils.setStorageData({ calendarGroups: mockGroups });
      
      const groups = await manager.loadGroups();
      
      expect(groups).toEqual(mockGroups);
      expect(manager.groups).toEqual(mockGroups);
    });

    test('ストレージが空の場合は空配列を返す', async () => {
      TestUtils.setStorageData({});
      
      const groups = await manager.loadGroups();
      
      expect(groups).toEqual([]);
      expect(manager.groups).toEqual([]);
    });

    test('エラー発生時は空配列を設定して例外を再スロー', async () => {
      const error = new Error('Storage error');
      ErrorHandler.wrapChromeApi.mockRejectedValue(error);
      
      await expect(manager.loadGroups()).rejects.toThrow(error);
      expect(manager.groups).toEqual([]);
    });
  });

  describe('createGroup', () => {
    test('新しいグループを正常に作成', async () => {
      const name = '新規グループ';
      const members = ['メンバー1', 'メンバー2'];
      
      const result = await manager.createGroup(name, members);
      
      expect(result).toBe(true);
      expect(manager.groups).toHaveLength(1);
      expect(manager.groups[0]).toEqual({ name, members });
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        { calendarGroups: [{ name, members }] }
      );
    });

    test('グループ名が空の場合はエラー', async () => {
      ErrorHandler.validationError.mockImplementation((type) => {
        throw new Error(`Validation error: ${type}`);
      });
      
      await expect(manager.createGroup('', ['メンバー1'])).rejects.toThrow('Validation error: empty_name');
    });

    test('メンバーが空の場合はエラー', async () => {
      ErrorHandler.validationError.mockImplementation((type) => {
        throw new Error(`Validation error: ${type}`);
      });
      
      await expect(manager.createGroup('グループ名', [])).rejects.toThrow('Validation error: empty_members');
    });

    test('重複するグループ名の場合はエラー', async () => {
      manager.groups = [{ name: '既存グループ', members: ['メンバー1'] }];
      
      ErrorHandler.validationError.mockImplementation((type) => {
        throw new Error(`Validation error: ${type}`);
      });
      
      await expect(manager.createGroup('既存グループ', ['メンバー2'])).rejects.toThrow('Validation error: duplicate_name');
    });
  });

  describe('updateGroup', () => {
    beforeEach(() => {
      manager.groups = [
        { name: 'グループ1', members: ['メンバー1'] },
        { name: 'グループ2', members: ['メンバー2'] }
      ];
    });

    test('既存のグループを正常に更新', async () => {
      const newName = '更新されたグループ';
      const newMembers = ['新メンバー1', '新メンバー2'];
      
      const result = await manager.updateGroup(0, newName, newMembers);
      
      expect(result).toBe(true);
      expect(manager.groups[0]).toEqual({ name: newName, members: newMembers });
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    test('無効なインデックスの場合はエラー', async () => {
      await expect(manager.updateGroup(-1, 'test', ['member'])).rejects.toThrow('無効なグループインデックス');
      await expect(manager.updateGroup(10, 'test', ['member'])).rejects.toThrow('無効なグループインデックス');
    });
  });

  describe('deleteGroup', () => {
    beforeEach(() => {
      manager.groups = [
        { name: 'グループ1', members: ['メンバー1'] },
        { name: 'グループ2', members: ['メンバー2'] },
        { name: 'グループ3', members: ['メンバー3'] }
      ];
      manager.expandedGroups = new Set([0, 2]);
    });

    test('グループを正常に削除', async () => {
      const deletedGroup = await manager.deleteGroup(1);
      
      expect(deletedGroup).toEqual({ name: 'グループ2', members: ['メンバー2'] });
      expect(manager.groups).toHaveLength(2);
      expect(manager.groups[0].name).toBe('グループ1');
      expect(manager.groups[1].name).toBe('グループ3');
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    test('expandedGroupsが正しく調整される', async () => {
      await manager.deleteGroup(1);
      
      // インデックス0は変わらず、インデックス2は1に調整される
      expect(manager.expandedGroups.has(0)).toBe(true);
      expect(manager.expandedGroups.has(1)).toBe(true);
      expect(manager.expandedGroups.has(2)).toBe(false);
    });
  });

  describe('moveGroup', () => {
    beforeEach(() => {
      manager.groups = [
        { name: 'グループA', members: ['A'] },
        { name: 'グループB', members: ['B'] },
        { name: 'グループC', members: ['C'] }
      ];
    });

    test('グループを前方に移動', async () => {
      const result = await manager.moveGroup(2, 0);
      
      expect(result).toBe(true);
      expect(manager.groups[0].name).toBe('グループC');
      expect(manager.groups[1].name).toBe('グループA');
      expect(manager.groups[2].name).toBe('グループB');
    });

    test('グループを後方に移動', async () => {
      const result = await manager.moveGroup(0, 2);
      
      expect(result).toBe(true);
      expect(manager.groups[0].name).toBe('グループB');
      expect(manager.groups[1].name).toBe('グループC');
      expect(manager.groups[2].name).toBe('グループA');
    });
  });

  describe('toggleGroupExpansion', () => {
    test('グループの展開状態を切り替え', () => {
      expect(manager.isGroupExpanded(0)).toBe(false);
      
      const expanded = manager.toggleGroupExpansion(0);
      expect(expanded).toBe(true);
      expect(manager.isGroupExpanded(0)).toBe(true);
      
      const collapsed = manager.toggleGroupExpansion(0);
      expect(collapsed).toBe(false);
      expect(manager.isGroupExpanded(0)).toBe(false);
    });
  });

  describe('編集機能', () => {
    test('編集中のグループインデックスを設定・取得', () => {
      expect(manager.getEditingGroupIndex()).toBe(null);
      
      manager.setEditingGroupIndex(2);
      expect(manager.getEditingGroupIndex()).toBe(2);
      
      manager.cancelEdit();
      expect(manager.getEditingGroupIndex()).toBe(null);
    });
  });
});
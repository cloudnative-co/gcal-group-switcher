/**
 * グループ管理モジュール
 * グループの作成、編集、削除、保存などの機能を提供
 */

class GroupManager {
  constructor() {
    this.groups = [];
    this.editingGroupIndex = null;
    this.expandedGroups = new Set();
    this.storageKey = 'calendarGroups';
  }

  /**
   * グループの読み込み
   */
  async loadGroups() {
    try {
      const result = await ErrorHandler.wrapChromeApi(
        () => chrome.storage.local.get([this.storageKey]),
        'storage'
      );
      this.groups = result[this.storageKey] || [];
      return this.groups;
    } catch (error) {
      this.groups = [];
      throw error;
    }
  }

  /**
   * グループの保存
   */
  async saveGroups() {
    return await ErrorHandler.wrapChromeApi(
      () => chrome.storage.local.set({ [this.storageKey]: this.groups }),
      'storage'
    );
  }

  /**
   * グループの作成
   */
  async createGroup(name, members) {
    // バリデーション
    if (!name) {
      throw ErrorHandler.validationError('empty_name');
    }
    if (!members || members.length === 0) {
      throw ErrorHandler.validationError('empty_members');
    }

    // 重複チェック
    const duplicateGroup = this.groups.find(g => g.name === name);
    if (duplicateGroup) {
      throw ErrorHandler.validationError('duplicate_name', { name });
    }

    // グループを追加
    this.groups.push({ name, members });
    await this.saveGroups();
    return true;
  }

  /**
   * グループの更新
   */
  async updateGroup(index, name, members) {
    if (index < 0 || index >= this.groups.length) {
      throw new Error('無効なグループインデックス');
    }

    // バリデーション
    if (!name) {
      throw ErrorHandler.validationError('empty_name');
    }
    if (!members || members.length === 0) {
      throw ErrorHandler.validationError('empty_members');
    }

    // 更新
    this.groups[index] = { name, members };
    await this.saveGroups();
    return true;
  }

  /**
   * グループの削除
   */
  async deleteGroup(index) {
    if (index < 0 || index >= this.groups.length) {
      throw new Error('無効なグループインデックス');
    }

    const group = this.groups[index];
    this.groups.splice(index, 1);
    
    // expandedGroupsの調整
    this.adjustExpandedGroups(index);
    
    await this.saveGroups();
    return group;
  }

  /**
   * グループの並び替え
   */
  async moveGroup(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= this.groups.length ||
        toIndex < 0 || toIndex >= this.groups.length) {
      throw new Error('無効なグループインデックス');
    }

    const [movedGroup] = this.groups.splice(fromIndex, 1);
    this.groups.splice(toIndex, 0, movedGroup);
    await this.saveGroups();
    return true;
  }

  /**
   * グループの取得
   */
  getGroup(index) {
    return this.groups[index];
  }

  /**
   * 全グループの取得
   */
  getAllGroups() {
    return [...this.groups];
  }

  /**
   * グループ数の取得
   */
  getGroupCount() {
    return this.groups.length;
  }

  /**
   * グループの展開状態を切り替え
   */
  toggleGroupExpansion(index) {
    if (this.expandedGroups.has(index)) {
      this.expandedGroups.delete(index);
      return false;
    } else {
      this.expandedGroups.add(index);
      return true;
    }
  }

  /**
   * グループが展開されているか確認
   */
  isGroupExpanded(index) {
    return this.expandedGroups.has(index);
  }

  /**
   * expandedGroupsの調整（削除時）
   */
  adjustExpandedGroups(deletedIndex) {
    const newExpandedGroups = new Set();
    this.expandedGroups.forEach(index => {
      if (index < deletedIndex) {
        newExpandedGroups.add(index);
      } else if (index > deletedIndex) {
        newExpandedGroups.add(index - 1);
      }
    });
    this.expandedGroups = newExpandedGroups;
  }

  /**
   * 編集中のグループインデックスを設定
   */
  setEditingGroupIndex(index) {
    this.editingGroupIndex = index;
  }

  /**
   * 編集中のグループインデックスを取得
   */
  getEditingGroupIndex() {
    return this.editingGroupIndex;
  }

  /**
   * 編集をキャンセル
   */
  cancelEdit() {
    this.editingGroupIndex = null;
  }
}

// シングルトンインスタンスを作成
const groupManager = new GroupManager();

// Chrome拡張機能での使用のため
if (typeof window !== 'undefined') {
  window.GroupManager = GroupManager;
  window.groupManager = groupManager;
}
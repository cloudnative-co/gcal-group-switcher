/**
 * UIManager の単体テスト
 */

// モジュールを読み込む前にグローバルを設定
global.VirtualScroll = class VirtualScroll {
  constructor(options) {
    this.options = options;
    this.items = [];
    this.scrollTop = 0;
  }
  
  setItems(items) {
    this.items = items;
  }
  
  setScrollTop(scrollTop) {
    this.scrollTop = scrollTop;
  }
  
  getTotalHeight() {
    return this.items.length * this.options.itemHeight;
  }
  
  getVisibleItems() {
    const start = Math.floor(this.scrollTop / this.options.itemHeight);
    const end = Math.ceil((this.scrollTop + this.options.containerHeight) / this.options.itemHeight);
    return this.items.slice(start, end + this.options.buffer);
  }
  
  getVisibleRange() {
    const start = Math.floor(this.scrollTop / this.options.itemHeight);
    const end = Math.ceil((this.scrollTop + this.options.containerHeight) / this.options.itemHeight);
    return { start, end };
  }
  
  getOffset() {
    const start = Math.floor(this.scrollTop / this.options.itemHeight);
    return start * this.options.itemHeight;
  }
};

// テスト対象を読み込む
const fs = require('fs');
const path = require('path');
const uiManagerCode = fs.readFileSync(
  path.join(__dirname, '../../uiManager.js'),
  'utf8'
);

// グローバルスコープで実行
eval(uiManagerCode);

describe('UIManager', () => {
  let uiManager;
  let mockGroupManager;
  let mockDocument;

  beforeEach(() => {
    // GroupManagerのモック
    mockGroupManager = {
      getAllGroups: jest.fn().mockReturnValue([]),
      isGroupExpanded: jest.fn().mockReturnValue(false),
      toggleGroupExpansion: jest.fn().mockReturnValue(true),
      getGroup: jest.fn().mockReturnValue({ name: 'テストグループ', members: ['メンバー1'] })
    };

    // DOMのモック
    mockDocument = {
      getElementById: jest.fn().mockReturnValue({
        innerHTML: '',
        style: {},
        parentElement: { style: {} },
        addEventListener: jest.fn(),
        querySelector: jest.fn(),
        cloneNode: jest.fn().mockReturnValue({
          addEventListener: jest.fn()
        }),
        parentNode: {
          replaceChild: jest.fn()
        }
      }),
      createElement: jest.fn().mockReturnValue({
        textContent: '',
        innerHTML: ''
      }),
      querySelector: jest.fn(),
      querySelectorAll: jest.fn().mockReturnValue([])
    };
    global.document = mockDocument;

    // Windowイベントのモック
    global.window = {
      dispatchEvent: jest.fn()
    };

    uiManager = new UIManager(mockGroupManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('renderGroupList', () => {
    test('グループが空の場合のメッセージ表示', () => {
      const groupListElement = mockDocument.getElementById();
      uiManager.renderGroupList();
      
      expect(groupListElement.innerHTML).toContain('保存済みグループはありません');
      expect(uiManager.virtualScroll).toBeNull();
    });

    test('通常のグループリスト表示', () => {
      const mockGroups = [
        { name: 'グループ1', members: ['メンバー1', 'メンバー2'] },
        { name: 'グループ2', members: ['メンバー3'] }
      ];
      mockGroupManager.getAllGroups.mockReturnValue(mockGroups);
      
      uiManager.renderGroupList();
      
      expect(mockDocument.getElementById).toHaveBeenCalledWith('groupList');
      expect(uiManager.setupGroupListEventDelegation).toBeDefined();
      expect(uiManager.setupDragAndDrop).toBeDefined();
    });

    test('仮想スクロールの有効化（20件以上）', () => {
      const mockGroups = Array(25).fill(0).map((_, i) => ({
        name: `グループ${i}`,
        members: [`メンバー${i}`]
      }));
      mockGroupManager.getAllGroups.mockReturnValue(mockGroups);
      
      // renderGroupListWithVirtualScrollをモック
      uiManager.renderGroupListWithVirtualScroll = jest.fn();
      
      uiManager.renderGroupList();
      
      expect(uiManager.renderGroupListWithVirtualScroll).toHaveBeenCalled();
    });
  });

  describe('createGroupItemHtml', () => {
    test('グループアイテムのHTML生成', () => {
      const group = {
        name: 'テストグループ',
        members: ['山田太郎', '鈴木花子']
      };
      
      const html = uiManager.createGroupItemHtml(group, 0);
      
      expect(html).toContain('テストグループ');
      expect(html).toContain('(2人)');
      expect(html).toContain('data-index="0"');
      expect(html).toContain('draggable="true"');
    });

    test('展開されたグループのHTML生成', () => {
      mockGroupManager.isGroupExpanded.mockReturnValue(true);
      const group = {
        name: 'テストグループ',
        members: ['山田太郎', '鈴木花子']
      };
      
      const html = uiManager.createGroupItemHtml(group, 0);
      
      expect(html).toContain('expanded');
      expect(html).toContain('山田太郎');
      expect(html).toContain('鈴木花子');
      expect(html).toContain('group-members-list');
    });

    test('XSS対策のHTMLエスケープ', () => {
      const group = {
        name: '<script>alert("XSS")</script>',
        members: ['<img src=x onerror="alert(1)">']
      };
      
      const html = uiManager.createGroupItemHtml(group, 0);
      
      expect(html).not.toContain('<script>');
      expect(html).not.toContain('<img src=x');
      expect(html).toContain('&lt;script&gt;');
    });
  });

  describe('toggleGroupExpansion', () => {
    test('グループの展開', () => {
      const mockGroupItem = {
        classList: {
          add: jest.fn(),
          remove: jest.fn()
        },
        querySelector: jest.fn().mockReturnValue({
          setAttribute: jest.fn()
        }),
        insertAdjacentHTML: jest.fn()
      };
      
      mockDocument.querySelector.mockReturnValue(mockGroupItem);
      mockGroupManager.toggleGroupExpansion.mockReturnValue(true);
      
      uiManager.toggleGroupExpansion(0);
      
      expect(mockGroupItem.classList.add).toHaveBeenCalledWith('expanded');
      expect(mockGroupItem.insertAdjacentHTML).toHaveBeenCalled();
    });

    test('グループの折りたたみ', () => {
      const mockMembersList = { remove: jest.fn() };
      const mockGroupItem = {
        classList: {
          add: jest.fn(),
          remove: jest.fn()
        },
        querySelector: jest.fn()
          .mockReturnValueOnce(mockMembersList) // .group-members-list
          .mockReturnValueOnce({ setAttribute: jest.fn() }) // .expand-icon svg polyline
      };
      
      mockDocument.querySelector.mockReturnValue(mockGroupItem);
      mockGroupManager.toggleGroupExpansion.mockReturnValue(false);
      
      uiManager.toggleGroupExpansion(0);
      
      expect(mockGroupItem.classList.remove).toHaveBeenCalledWith('expanded');
      expect(mockMembersList.remove).toHaveBeenCalled();
    });
  });

  describe('animateGroupDeletion', () => {
    test('削除アニメーションの実行', (done) => {
      const mockGroupItem = {
        style: {},
        remove: jest.fn()
      };
      mockDocument.querySelector.mockReturnValue(mockGroupItem);
      uiManager.updateGroupIndices = jest.fn();
      
      const callback = jest.fn();
      uiManager.animateGroupDeletion(0, callback);
      
      expect(mockGroupItem.style.opacity).toBe('0');
      expect(mockGroupItem.style.transform).toBe('translateX(-100%)');
      
      setTimeout(() => {
        expect(mockGroupItem.remove).toHaveBeenCalled();
        expect(uiManager.updateGroupIndices).toHaveBeenCalled();
        expect(callback).toHaveBeenCalled();
        done();
      }, 350);
    });
  });

  describe('setupGroupListEventDelegation', () => {
    test('イベント委譲の設定', () => {
      const mockGroupList = {
        cloneNode: jest.fn().mockReturnValue({
          addEventListener: jest.fn()
        }),
        parentNode: {
          replaceChild: jest.fn()
        }
      };
      mockDocument.getElementById.mockReturnValue(mockGroupList);
      
      uiManager.setupGroupListEventDelegation();
      
      expect(mockGroupList.cloneNode).toHaveBeenCalledWith(true);
      expect(mockGroupList.parentNode.replaceChild).toHaveBeenCalled();
    });

    test('クリックイベントの処理', () => {
      const mockNewGroupList = {
        addEventListener: jest.fn()
      };
      const mockGroupList = {
        cloneNode: jest.fn().mockReturnValue(mockNewGroupList),
        parentNode: {
          replaceChild: jest.fn()
        }
      };
      mockDocument.getElementById.mockReturnValue(mockGroupList);
      
      uiManager.setupGroupListEventDelegation();
      
      // イベントリスナーが追加されたことを確認
      expect(mockNewGroupList.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      
      // クリックイベントのシミュレーション
      const clickHandler = mockNewGroupList.addEventListener.mock.calls[0][1];
      const mockEvent = {
        target: {
          closest: jest.fn()
            .mockReturnValueOnce(null) // .group-info
            .mockReturnValue({ // ボタン
              dataset: { index: '0' },
              classList: { contains: jest.fn().mockReturnValue(true) }
            })
        }
      };
      
      clickHandler(mockEvent);
      
      expect(window.dispatchEvent).toHaveBeenCalled();
    });
  });

  describe('ドラッグ&ドロップ', () => {
    test('ドラッグ開始', () => {
      const mockEvent = {
        currentTarget: {
          dataset: { index: '0' },
          classList: { add: jest.fn() },
          innerHTML: '<div>test</div>'
        },
        dataTransfer: {
          effectAllowed: '',
          setData: jest.fn()
        }
      };
      
      uiManager.handleDragStart(mockEvent);
      
      expect(mockEvent.currentTarget.classList.add).toHaveBeenCalledWith('dragging');
      expect(mockEvent.dataTransfer.effectAllowed).toBe('move');
      expect(uiManager.draggedIndex).toBe(0);
    });

    test('ドロップ処理', () => {
      uiManager.draggedIndex = 0;
      uiManager.draggedElement = { dummy: 'element' };
      
      const mockEvent = {
        stopPropagation: jest.fn(),
        currentTarget: {
          dataset: { index: '2' }
        }
      };
      
      uiManager.handleDrop(mockEvent);
      
      expect(window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'moveGroup',
          detail: { fromIndex: 0, toIndex: 2 }
        })
      );
    });
  });

  describe('仮想スクロール', () => {
    test('仮想スクロールの初期化', () => {
      const mockGroups = Array(30).fill(0).map((_, i) => ({
        name: `グループ${i}`,
        members: [`メンバー${i}`]
      }));
      
      const mockContainer = {
        style: {},
        addEventListener: jest.fn()
      };
      const mockGroupList = {
        style: {},
        parentElement: mockContainer
      };
      mockDocument.getElementById.mockReturnValue(mockGroupList);
      
      uiManager.renderGroupListWithVirtualScroll();
      
      expect(uiManager.virtualScroll).toBeDefined();
      expect(mockContainer.style.height).toBe('400px');
      expect(mockContainer.style.overflow).toBe('auto');
      expect(mockContainer.addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));
    });

    test('可視範囲のグループのみレンダリング', () => {
      uiManager.virtualScroll = new VirtualScroll({
        itemHeight: 80,
        containerHeight: 400,
        buffer: 3
      });
      
      const mockGroups = Array(10).fill(0).map((_, i) => ({
        name: `グループ${i}`,
        members: [`メンバー${i}`]
      }));
      uiManager.virtualScroll.setItems(mockGroups);
      
      const mockGroupList = {
        querySelector: jest.fn().mockReturnValue(null),
        appendChild: jest.fn()
      };
      mockDocument.getElementById.mockReturnValue(mockGroupList);
      
      uiManager.renderVisibleGroups();
      
      expect(mockGroupList.appendChild).toHaveBeenCalled();
    });
  });

  describe('フォーム操作', () => {
    test('編集フォームの値設定', () => {
      const mockInputs = {
        groupName: { value: '' },
        memberInput: { value: '' },
        createGroup: { textContent: '' },
        cancelEdit: { style: { display: '' } }
      };
      
      mockDocument.getElementById.mockImplementation(id => mockInputs[id]);
      
      uiManager.setEditFormValues('編集グループ', ['メンバー1', 'メンバー2']);
      
      expect(mockInputs.groupName.value).toBe('編集グループ');
      expect(mockInputs.memberInput.value).toBe('メンバー1\nメンバー2');
      expect(mockInputs.createGroup.textContent).toBe('グループ更新');
      expect(mockInputs.cancelEdit.style.display).toBe('inline-block');
    });

    test('フォームのクリア', () => {
      const mockInputs = {
        groupName: { value: 'test' },
        memberInput: { value: 'test' },
        createGroup: { textContent: 'test' },
        cancelEdit: { style: { display: 'inline-block' } }
      };
      
      mockDocument.getElementById.mockImplementation(id => mockInputs[id]);
      
      uiManager.clearEditForm();
      
      expect(mockInputs.groupName.value).toBe('');
      expect(mockInputs.memberInput.value).toBe('');
      expect(mockInputs.createGroup.textContent).toBe('グループ作成');
      expect(mockInputs.cancelEdit.style.display).toBe('none');
    });

    test('フォーム値の取得', () => {
      const mockInputs = {
        groupName: { value: '  新規グループ  ' },
        memberInput: { value: 'メンバー1\n\nメンバー2\n  ' }
      };
      
      mockDocument.getElementById.mockImplementation(id => mockInputs[id]);
      
      const { name, members } = uiManager.getFormValues();
      
      expect(name).toBe('新規グループ');
      expect(members).toEqual(['メンバー1', 'メンバー2']);
    });
  });

  describe('updateGroupIndices', () => {
    test('グループインデックスの更新', () => {
      const mockItems = [
        {
          setAttribute: jest.fn(),
          querySelectorAll: jest.fn().mockReturnValue([
            { setAttribute: jest.fn() },
            { setAttribute: jest.fn() }
          ])
        },
        {
          setAttribute: jest.fn(),
          querySelectorAll: jest.fn().mockReturnValue([
            { setAttribute: jest.fn() }
          ])
        }
      ];
      
      mockDocument.querySelectorAll.mockReturnValue(mockItems);
      
      uiManager.updateGroupIndices();
      
      expect(mockItems[0].setAttribute).toHaveBeenCalledWith('data-index', 0);
      expect(mockItems[1].setAttribute).toHaveBeenCalledWith('data-index', 1);
    });
  });

  describe('escapeHtml', () => {
    test('HTMLのエスケープ処理', () => {
      const mockDiv = {
        textContent: '',
        innerHTML: ''
      };
      mockDocument.createElement.mockReturnValue(mockDiv);
      
      const dangerous = '<script>alert("XSS")</script>';
      const result = uiManager.escapeHtml(dangerous);
      
      expect(mockDiv.textContent).toBe(dangerous);
    });
  });
});
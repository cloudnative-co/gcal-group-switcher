/**
 * UI管理モジュール
 * DOM操作、イベント処理、メッセージ表示などのUI関連機能を提供
 */

class UIManager {
  constructor(groupManager) {
    this.groupManager = groupManager;
    this.virtualScroll = null;
    this.VIRTUAL_SCROLL_THRESHOLD = 20;
    this.messageTimeouts = new Map();
  }

  /**
   * グループリストのレンダリング
   */
  renderGroupList() {
    const groups = this.groupManager.getAllGroups();
    const groupListElement = document.getElementById('groupList');
    
    if (groups.length === 0) {
      groupListElement.innerHTML = '<p style="color: #5f6368; text-align: center;">保存済みグループはありません</p>';
      if (this.virtualScroll) {
        this.virtualScroll = null;
      }
      return;
    }
    
    // 仮想スクロールの判定
    if (groups.length > this.VIRTUAL_SCROLL_THRESHOLD) {
      this.renderGroupListWithVirtualScroll();
    } else {
      this.renderGroupListNormal();
    }
    
    // イベント委譲を設定
    this.setupGroupListEventDelegation();
    
    // ドラッグ＆ドロップを設定
    this.setupDragAndDrop();
  }

  /**
   * 通常のレンダリング
   */
  renderGroupListNormal() {
    const groups = this.groupManager.getAllGroups();
    const groupListElement = document.getElementById('groupList');
    
    groupListElement.innerHTML = groups.map((group, index) => 
      this.createGroupItemHtml(group, index)
    ).join('');
    
    // 仮想スクロールをクリア
    if (this.virtualScroll) {
      this.virtualScroll = null;
      groupListElement.style.height = '';
      groupListElement.style.overflow = '';
      groupListElement.parentElement.style.height = '';
    }
  }

  /**
   * 仮想スクロールでのレンダリング
   */
  renderGroupListWithVirtualScroll() {
    const groups = this.groupManager.getAllGroups();
    const groupListElement = document.getElementById('groupList');
    const container = groupListElement.parentElement;
    
    // 仮想スクロールの初期化
    if (!this.virtualScroll) {
      this.virtualScroll = new VirtualScroll({
        itemHeight: 80,
        containerHeight: 400,
        buffer: 3
      });
      
      // コンテナのスタイル設定
      container.style.height = '400px';
      container.style.overflow = 'auto';
      container.style.position = 'relative';
      
      // スクロールイベントの設定
      container.addEventListener('scroll', () => {
        this.virtualScroll.setScrollTop(container.scrollTop);
        this.renderVisibleGroups();
      });
    }
    
    this.virtualScroll.setItems(groups);
    
    // 全体の高さを設定
    groupListElement.style.height = `${this.virtualScroll.getTotalHeight()}px`;
    groupListElement.style.position = 'relative';
    
    this.renderVisibleGroups();
  }

  /**
   * 表示範囲のグループのみレンダリング
   */
  renderVisibleGroups() {
    const groupListElement = document.getElementById('groupList');
    const visibleGroups = this.virtualScroll.getVisibleItems();
    const range = this.virtualScroll.getVisibleRange();
    const offset = this.virtualScroll.getOffset();
    
    // 既存の仮想アイテムをクリア
    const existingVirtualContainer = groupListElement.querySelector('.virtual-scroll-container');
    if (existingVirtualContainer) {
      existingVirtualContainer.remove();
    }
    
    // 仮想スクロールコンテナを作成
    const virtualContainer = document.createElement('div');
    virtualContainer.className = 'virtual-scroll-container';
    virtualContainer.style.position = 'absolute';
    virtualContainer.style.top = `${offset}px`;
    virtualContainer.style.left = '0';
    virtualContainer.style.right = '0';
    
    // 表示範囲のグループをレンダリング
    virtualContainer.innerHTML = visibleGroups.map((group, localIndex) => {
      const actualIndex = range.start + localIndex;
      return this.createGroupItemHtml(group, actualIndex);
    }).join('');
    
    groupListElement.appendChild(virtualContainer);
  }

  /**
   * グループアイテムのHTML生成
   */
  createGroupItemHtml(group, index) {
    const isExpanded = this.groupManager.isGroupExpanded(index);
    return `
      <div class="group-item ${isExpanded ? 'expanded' : ''}" data-index="${index}" draggable="true">
        <div class="group-content">
          <div class="drag-handle" title="ドラッグして並び替え">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="9" cy="5" r="1.5"/>
              <circle cx="15" cy="5" r="1.5"/>
              <circle cx="9" cy="12" r="1.5"/>
              <circle cx="15" cy="12" r="1.5"/>
              <circle cx="9" cy="19" r="1.5"/>
              <circle cx="15" cy="19" r="1.5"/>
            </svg>
          </div>
          <div class="group-info" data-index="${index}">
            <div class="group-header">
              <div class="expand-icon">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="${isExpanded ? '6 9 12 15 18 9' : '9 6 15 12 9 18'}"></polyline>
                </svg>
              </div>
              <div class="group-name">${this.escapeHtml(group.name)}</div>
              <div class="group-count">(${group.members.length}人)</div>
            </div>
          </div>
          <div class="group-actions">
            <button class="btn btn-primary btn-small apply-btn" data-index="${index}">適用</button>
            <button class="btn btn-secondary btn-small edit-btn" data-index="${index}">編集</button>
            <button class="btn btn-danger btn-small delete-btn" data-index="${index}">削除</button>
          </div>
        </div>
        ${isExpanded ? `
          <div class="group-members-list">
            ${group.members.map(member => `
              <div class="member-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                ${this.escapeHtml(member)}
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * イベント委譲の設定
   */
  setupGroupListEventDelegation() {
    const groupListElement = document.getElementById('groupList');
    
    // 既存のイベントリスナーを削除
    const newGroupList = groupListElement.cloneNode(true);
    groupListElement.parentNode.replaceChild(newGroupList, groupListElement);
    
    // イベント委譲でクリックイベントを処理
    newGroupList.addEventListener('click', (e) => {
      const target = e.target;
      
      // グループ情報のクリック
      const groupInfo = target.closest('.group-info');
      if (groupInfo && !target.closest('.group-actions')) {
        const index = parseInt(groupInfo.dataset.index);
        if (!isNaN(index)) {
          this.toggleGroupExpansion(index);
        }
        return;
      }
      
      // ボタンのクリック処理はメインファイルで処理
      const btn = target.closest('[data-index]');
      if (btn) {
        const index = parseInt(btn.dataset.index);
        if (!isNaN(index)) {
          if (btn.classList.contains('apply-btn')) {
            window.dispatchEvent(new CustomEvent('applyGroup', { detail: { index } }));
          } else if (btn.classList.contains('edit-btn')) {
            window.dispatchEvent(new CustomEvent('editGroup', { detail: { index } }));
          } else if (btn.classList.contains('delete-btn')) {
            window.dispatchEvent(new CustomEvent('deleteGroup', { detail: { index } }));
          }
        }
      }
    });
  }

  /**
   * グループの展開/折りたたみ
   */
  toggleGroupExpansion(index) {
    const groupItem = document.querySelector(`.group-item[data-index="${index}"]`);
    if (!groupItem) return;
    
    const isExpanded = this.groupManager.toggleGroupExpansion(index);
    const group = this.groupManager.getGroup(index);
    
    if (!isExpanded) {
      // 折りたたみ
      groupItem.classList.remove('expanded');
      
      // メンバーリストを削除
      const membersList = groupItem.querySelector('.group-members-list');
      if (membersList) {
        membersList.remove();
      }
      
      // 展開アイコンを更新
      const expandIcon = groupItem.querySelector('.expand-icon svg polyline');
      if (expandIcon) {
        expandIcon.setAttribute('points', '9 6 15 12 9 18');
      }
    } else {
      // 展開
      groupItem.classList.add('expanded');
      
      // メンバーリストを追加
      const membersListHtml = `
        <div class="group-members-list">
          ${group.members.map(member => `
            <div class="member-item">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              ${this.escapeHtml(member)}
            </div>
          `).join('')}
        </div>
      `;
      groupItem.insertAdjacentHTML('beforeend', membersListHtml);
      
      // 展開アイコンを更新
      const expandIcon = groupItem.querySelector('.expand-icon svg polyline');
      if (expandIcon) {
        expandIcon.setAttribute('points', '6 9 12 15 18 9');
      }
    }
  }

  /**
   * グループの削除（アニメーション付き）
   */
  animateGroupDeletion(index, callback) {
    const groupItem = document.querySelector(`.group-item[data-index="${index}"]`);
    if (groupItem) {
      // アニメーション付きで削除
      groupItem.style.transition = 'opacity 0.3s, transform 0.3s';
      groupItem.style.opacity = '0';
      groupItem.style.transform = 'translateX(-100%)';
      
      setTimeout(() => {
        groupItem.remove();
        this.updateGroupIndices();
        if (callback) callback();
      }, 300);
    } else {
      this.renderGroupList();
      if (callback) callback();
    }
  }

  /**
   * グループのインデックスを更新
   */
  updateGroupIndices() {
    const groupItems = document.querySelectorAll('.group-item');
    groupItems.forEach((item, newIndex) => {
      // data-index属性を更新
      item.setAttribute('data-index', newIndex);
      
      // 内部の要素のdata-indexも更新
      const elementsWithIndex = item.querySelectorAll('[data-index]');
      elementsWithIndex.forEach(el => {
        el.setAttribute('data-index', newIndex);
      });
    });
  }

  /**
   * ドラッグ＆ドロップの設定
   */
  setupDragAndDrop() {
    const items = document.querySelectorAll('.group-item');
    items.forEach(item => {
      item.addEventListener('dragstart', this.handleDragStart.bind(this));
      item.addEventListener('dragenter', this.handleDragEnter.bind(this));
      item.addEventListener('dragover', this.handleDragOver.bind(this));
      item.addEventListener('dragleave', this.handleDragLeave.bind(this));
      item.addEventListener('drop', this.handleDrop.bind(this));
      item.addEventListener('dragend', this.handleDragEnd.bind(this));
    });
  }

  // ドラッグ＆ドロップのハンドラー
  handleDragStart(e) {
    this.draggedElement = e.currentTarget;
    this.draggedIndex = parseInt(e.currentTarget.dataset.index);
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.currentTarget.innerHTML);
  }

  handleDragEnter(e) {
    e.currentTarget.classList.add('drag-over');
  }

  handleDragOver(e) {
    if (e.preventDefault) {
      e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
  }

  handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
  }

  handleDrop(e) {
    if (e.stopPropagation) {
      e.stopPropagation();
    }
    
    const dropIndex = parseInt(e.currentTarget.dataset.index);
    
    if (this.draggedElement !== e.currentTarget && this.draggedIndex !== null) {
      // グループの移動イベントを発行
      window.dispatchEvent(new CustomEvent('moveGroup', { 
        detail: { 
          fromIndex: this.draggedIndex, 
          toIndex: dropIndex 
        } 
      }));
    }
    
    return false;
  }

  handleDragEnd(e) {
    const items = document.querySelectorAll('.group-item');
    items.forEach(item => {
      item.classList.remove('dragging', 'drag-over');
    });
    this.draggedElement = null;
    this.draggedIndex = null;
  }

  /**
   * HTMLエスケープ
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 編集フォームの設定
   */
  setEditFormValues(name, members) {
    document.getElementById('groupName').value = name;
    document.getElementById('memberInput').value = members.join('\n');
    document.getElementById('createGroup').textContent = 'グループ更新';
    document.getElementById('cancelEdit').style.display = 'inline-block';
  }

  /**
   * 編集フォームのクリア
   */
  clearEditForm() {
    document.getElementById('groupName').value = '';
    document.getElementById('memberInput').value = '';
    document.getElementById('createGroup').textContent = 'グループ作成';
    document.getElementById('cancelEdit').style.display = 'none';
  }

  /**
   * フォームの値を取得
   */
  getFormValues() {
    const nameInput = document.getElementById('groupName');
    const memberInput = document.getElementById('memberInput');
    
    const name = nameInput.value.trim();
    const members = memberInput.value.split('\n').map(m => m.trim()).filter(m => m);
    
    return { name, members };
  }
}

// Chrome拡張機能での使用のため
if (typeof window !== 'undefined') {
  window.UIManager = UIManager;
}
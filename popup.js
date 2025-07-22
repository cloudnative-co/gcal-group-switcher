/**
 * メインアプリケーションファイル
 * 各モジュールを統合して、拡張機能の動作を管理
 */

// アプリケーションのメインクラス
class CalendarGroupApp {
  constructor() {
    this.groupManager = groupManager;
    this.calendarService = calendarService;
    this.uiManager = new UIManager(this.groupManager);
    this.autocompleteManager = null;
    this.lastDebugInfo = '';
    
    // イベントリスナーをバインド
    this.bindEvents();
  }

  /**
   * アプリケーションの初期化
   */
  async initialize() {
    try {
      await this.groupManager.loadGroups();
      await this.calendarService.loadCalendars();
      this.uiManager.renderGroupList();
      this.setupEventListeners();
      this.autocompleteManager = new AutocompleteManager(
        this.calendarService.getCalendarList()
      );
    } catch (error) {
      ErrorHandler.logError(error);
      ErrorHandler.showUserError(error);
    }
  }

  /**
   * イベントリスナーの設定
   */
  setupEventListeners() {
    document.getElementById('createGroup').addEventListener('click', () => this.handleCreateGroup());
    document.getElementById('cancelEdit').addEventListener('click', () => this.handleCancelEdit());
    document.getElementById('memberInput').addEventListener('input', (e) => this.autocompleteManager?.handleInput(e));
    document.getElementById('memberInput').addEventListener('keydown', (e) => this.autocompleteManager?.handleKeyDown(e));
    document.getElementById('showDebugInfo').addEventListener('click', () => this.showDebugInfo());
    document.getElementById('copyDebugInfo').addEventListener('click', () => this.copyDebugInfo());
    document.getElementById('showMyCalendarOnly').addEventListener('click', () => this.showMyCalendarOnly());
    
    // クリックでオートコンプリートを閉じる
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.member-input-container')) {
        this.autocompleteManager?.hide();
      }
    });
  }

  /**
   * カスタムイベントのバインド
   */
  bindEvents() {
    window.addEventListener('applyGroup', (e) => this.applyGroup(e.detail.index));
    window.addEventListener('editGroup', (e) => this.editGroup(e.detail.index));
    window.addEventListener('deleteGroup', (e) => this.deleteGroup(e.detail.index));
    window.addEventListener('moveGroup', (e) => this.moveGroup(e.detail.fromIndex, e.detail.toIndex));
  }

  /**
   * グループの作成/更新
   */
  async handleCreateGroup() {
    try {
      const { name, members } = this.uiManager.getFormValues();
      const editingIndex = this.groupManager.getEditingGroupIndex();
      
      if (editingIndex !== null) {
        // 更新
        await this.groupManager.updateGroup(editingIndex, name, members);
        showSuccessMessage('グループを更新しました');
        this.handleCancelEdit();
      } else {
        // 新規作成
        await this.groupManager.createGroup(name, members);
        showSuccessMessage('グループを作成しました');
        this.uiManager.clearEditForm();
      }
      
      this.uiManager.renderGroupList();
    } catch (error) {
      ErrorHandler.logError(error);
      ErrorHandler.showUserError(error);
    }
  }

  /**
   * 編集のキャンセル
   */
  handleCancelEdit() {
    this.groupManager.cancelEdit();
    this.uiManager.clearEditForm();
    showSuccessMessage('編集をキャンセルしました');
  }

  /**
   * グループの適用
   */
  async applyGroup(index) {
    try {
      const group = this.groupManager.getGroup(index);
      if (!group) {
        throw new Error('グループが見つかりません');
      }
      
      await this.calendarService.applyGroup(group.members);
      showSuccessMessage(`"${group.name}" を適用しました`);
      
      // ポップアップを自動で閉じる
      setTimeout(() => {
        window.close();
      }, 1000);
    } catch (error) {
      ErrorHandler.logError(error);
      ErrorHandler.showUserError(error);
    }
  }

  /**
   * グループの編集
   */
  editGroup(index) {
    const group = this.groupManager.getGroup(index);
    if (!group) return;
    
    this.groupManager.setEditingGroupIndex(index);
    this.uiManager.setEditFormValues(group.name, group.members);
    showSuccessMessage(`"${group.name}" を編集中`);
  }

  /**
   * グループの削除
   */
  async deleteGroup(index) {
    try {
      const group = this.groupManager.getGroup(index);
      if (!group) {
        throw new Error('グループが見つかりません');
      }
      
      if (confirm(`グループ "${group.name}" を削除しますか？`)) {
        await this.groupManager.deleteGroup(index);
        this.uiManager.animateGroupDeletion(index, () => {
          showSuccessMessage('グループを削除しました');
        });
      }
    } catch (error) {
      ErrorHandler.logError(error);
      ErrorHandler.showUserError(error);
    }
  }

  /**
   * グループの移動
   */
  async moveGroup(fromIndex, toIndex) {
    try {
      await this.groupManager.moveGroup(fromIndex, toIndex);
      this.uiManager.renderGroupList();
      showSuccessMessage('グループの順序を変更しました');
    } catch (error) {
      // エラー時は元に戻す
      await this.groupManager.moveGroup(toIndex, fromIndex);
      ErrorHandler.logError(error);
      ErrorHandler.showUserError(error);
    }
  }

  /**
   * 自分のカレンダーのみを表示
   */
  async showMyCalendarOnly() {
    try {
      await this.calendarService.showMyCalendarOnly();
      showSuccessMessage('自分のカレンダーのみを表示しました');
      
      // ポップアップを自動で閉じる
      setTimeout(() => {
        window.close();
      }, 1000);
    } catch (error) {
      ErrorHandler.logError(error);
      ErrorHandler.showUserError(error);
    }
  }

  /**
   * デバッグ情報を表示
   */
  async showDebugInfo() {
    const debugDiv = document.getElementById('debugInfo');
    const copyButton = document.getElementById('copyDebugInfo');
    debugDiv.style.display = 'block';
    debugDiv.innerHTML = 'デバッグ情報を取得中...';
    
    try {
      const environmentInfo = {
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        extensionVersion: chrome.runtime.getManifest().version,
        debugMode: localStorage.getItem('debug_mode') === 'true'
      };
      
      const debugData = await this.calendarService.getDebugInfo();
      const storageInfo = await chrome.storage.local.get(null);
      const errorLogs = ErrorHandler.getRecentErrors ? ErrorHandler.getRecentErrors(10) : [];
      
      const debugInfo = this.formatDebugInfo({
        environmentInfo,
        ...debugData,
        storageInfo,
        errorLogs
      });
      
      debugDiv.innerHTML = debugInfo.replace(/\n/g, '<br>');
      this.lastDebugInfo = debugInfo;
      copyButton.style.display = 'block';
    } catch (error) {
      ErrorHandler.logError(error);
      const errorInfo = this.formatDebugError(error);
      debugDiv.innerHTML = errorInfo.replace(/\n/g, '<br>');
      this.lastDebugInfo = errorInfo;
      copyButton.style.display = 'block';
    }
  }

  /**
   * デバッグ情報のフォーマット
   */
  formatDebugInfo(data) {
    const { environmentInfo, tabInfo, domInfo, calendars, storageInfo, errorLogs } = data;
    
    return `=== デバッグ情報 ===
生成時刻: ${new Date(environmentInfo.timestamp).toLocaleString('ja-JP')}
拡張機能バージョン: ${environmentInfo.extensionVersion}
デバッグモード: ${environmentInfo.debugMode ? 'ON' : 'OFF'}

【タブ情報】
URL: ${tabInfo.url}
ステータス: ${tabInfo.status}

【カレンダーリスト】
カレンダー数: ${calendars.length}個
${calendars.slice(0, 10).map((cal, i) => `  ${i + 1}. "${cal}"`).join('\n')}
${calendars.length > 10 ? '  ... (他にもあります)' : ''}

【DOM構造情報】
チェックボックス総数: ${domInfo.checkboxCount}個
マイカレンダーセクション: ${domInfo.pageStructure?.hasMyCalendarsSection ? '存在' : '不在'}
他のカレンダーセクション: ${domInfo.pageStructure?.hasOtherCalendarsSection ? '存在' : '不在'}

【保存データ】
グループ数: ${storageInfo?.calendarGroups?.length || 0}個

【最近のエラー】
${errorLogs.length > 0 ? errorLogs.slice(0, 3).map(log => `- ${log.message}`).join('\n') : 'エラーなし'}`;
  }

  /**
   * デバッグエラーのフォーマット
   */
  formatDebugError(error) {
    return `=== デバッグ情報取得エラー ===

エラー: ${error.message}

【対処方法】
1. Googleカレンダーのページをリロード(F5)してください
2. 拡張機能のポップアップを再度開いてください

【基本情報】
タイムスタンプ: ${new Date().toISOString()}
エラー詳細: ${error.stack || error.message}`;
  }

  /**
   * デバッグ情報をクリップボードにコピー
   */
  async copyDebugInfo() {
    try {
      await navigator.clipboard.writeText(this.lastDebugInfo);
      showSuccessMessage('デバッグ情報をコピーしました');
    } catch (error) {
      // フォールバック
      const textarea = document.createElement('textarea');
      textarea.value = this.lastDebugInfo;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      
      try {
        document.execCommand('copy');
        showSuccessMessage('デバッグ情報をコピーしました');
      } catch (e) {
        showErrorMessage(new Error('コピーに失敗しました'));
      }
      
      document.body.removeChild(textarea);
    }
  }
}

/**
 * オートコンプリート管理クラス
 */
class AutocompleteManager {
  constructor(calendars) {
    this.calendars = calendars;
    this.selectedIndex = -1;
    this.currentSuggestions = [];
  }

  handleInput(e) {
    const input = e.target;
    const lines = input.value.split('\n');
    const currentLine = lines[lines.length - 1];
    
    if (currentLine.trim()) {
      this.currentSuggestions = calendarService.getCalendarSuggestions(currentLine);
      if (this.currentSuggestions.length > 0) {
        this.show(input, this.currentSuggestions);
      } else {
        this.hide();
      }
    } else {
      this.hide();
    }
  }

  handleKeyDown(e) {
    const autocompleteList = document.querySelector('.autocomplete-list');
    if (!autocompleteList || autocompleteList.style.display === 'none') return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.selectedIndex = Math.min(this.selectedIndex + 1, this.currentSuggestions.length - 1);
      this.updateSelection();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
      this.updateSelection();
    } else if (e.key === 'Enter' && this.selectedIndex >= 0) {
      e.preventDefault();
      this.selectSuggestion(this.selectedIndex);
    } else if (e.key === 'Escape') {
      this.hide();
    }
  }

  show(input, suggestions) {
    let autocompleteList = document.querySelector('.autocomplete-list');
    if (!autocompleteList) {
      autocompleteList = document.createElement('div');
      autocompleteList.className = 'autocomplete-list';
      input.parentElement.appendChild(autocompleteList);
    }
    
    autocompleteList.innerHTML = suggestions.map((suggestion, index) => 
      `<div class="autocomplete-item ${index === this.selectedIndex ? 'selected' : ''}" data-index="${index}">
        ${this.escapeHtml(suggestion)}
      </div>`
    ).join('');
    
    autocompleteList.style.display = 'block';
    
    // クリックイベント
    autocompleteList.querySelectorAll('.autocomplete-item').forEach(item => {
      item.addEventListener('click', () => {
        this.selectSuggestion(parseInt(item.dataset.index));
      });
    });
  }

  hide() {
    const autocompleteList = document.querySelector('.autocomplete-list');
    if (autocompleteList) {
      autocompleteList.style.display = 'none';
    }
    this.selectedIndex = -1;
  }

  updateSelection() {
    const items = document.querySelectorAll('.autocomplete-item');
    items.forEach((item, index) => {
      if (index === this.selectedIndex) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    });
  }

  selectSuggestion(index) {
    const suggestion = this.currentSuggestions[index];
    if (!suggestion) return;
    
    const input = document.getElementById('memberInput');
    const lines = input.value.split('\n');
    lines[lines.length - 1] = suggestion;
    input.value = lines.join('\n');
    
    this.hide();
    input.focus();
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// アプリケーションの初期化
document.addEventListener('DOMContentLoaded', async () => {
  const app = new CalendarGroupApp();
  await app.initialize();
});

// グローバル関数（後方互換性のため）
function showMessage(text, type = 'info', duration = 3000, actions = null) {
  const messageElement = document.getElementById('message');
  clearTimeout(messageElement._hideTimer);
  messageElement.innerHTML = '';
  
  const textSpan = document.createElement('span');
  textSpan.textContent = text;
  textSpan.className = 'message-text';
  messageElement.appendChild(textSpan);
  
  if (actions && Array.isArray(actions)) {
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'message-actions';
    
    actions.forEach(action => {
      const button = document.createElement('button');
      button.textContent = action.text;
      button.className = `message-action-btn ${action.type || 'secondary'}`;
      button.onclick = () => {
        if (typeof action.handler === 'function') {
          action.handler();
        }
        hideMessage();
      };
      actionsContainer.appendChild(button);
    });
    
    messageElement.appendChild(actionsContainer);
  }
  
  const iconMap = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };
  
  if (iconMap[type]) {
    textSpan.textContent = `${iconMap[type]} ${text}`;
  }
  
  messageElement.className = `message ${type}`;
  
  if (duration > 0) {
    messageElement._hideTimer = setTimeout(() => {
      hideMessage();
    }, duration);
  }
}

function hideMessage() {
  const messageElement = document.getElementById('message');
  messageElement.className = 'message';
  messageElement.innerHTML = '';
  clearTimeout(messageElement._hideTimer);
}

function showErrorMessage(error, showRetryAction = false) {
  let message = 'エラーが発生しました';
  let actions = [];
  
  if (error instanceof CalendarGroupError) {
    message = error.toUserMessage();
  } else if (error && error.message) {
    message = error.message;
  }
  
  if (showRetryAction) {
    actions.push({
      text: 'リトライ',
      type: 'primary',
      handler: () => {
        window.location.reload();
      }
    });
  }
  
  if (localStorage.getItem('debug_mode') === 'true') {
    actions.push({
      text: '詳細',
      type: 'secondary',
      handler: () => {
        console.error('Error details:', error);
        if (error instanceof CalendarGroupError) {
          console.error('Debug info:', error.toDebugInfo());
        }
      }
    });
  }
  
  showMessage(message, 'error', 5000, actions.length > 0 ? actions : null);
}

function showSuccessMessage(message, autoClose = true) {
  showMessage(message, 'success', autoClose ? 2000 : 0);
}

function showWarningMessage(message, actions = null) {
  showMessage(message, 'warning', 4000, actions);
}
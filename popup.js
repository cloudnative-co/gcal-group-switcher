// グループデータの管理
let groups = [];
let allCalendars = [];
let lastDebugInfo = '';
let editingGroupIndex = null;
let expandedGroups = new Set();

// エラーログ管理
const ErrorLogger = {
  // エラーログの最大保存数
  MAX_ERROR_LOGS: 100,
  
  // エラーをストレージに保存
  async saveError(error, context = 'popup') {
    try {
      const errorLog = {
        timestamp: new Date().toISOString(),
        context: context,
        message: error.message || String(error),
        stack: error.stack || '',
        url: window.location.href,
        userAgent: navigator.userAgent
      };
      
      // 既存のログを取得
      const result = await chrome.storage.local.get(['errorLogs']);
      const errorLogs = result.errorLogs || [];
      
      // 新しいエラーを追加
      errorLogs.unshift(errorLog);
      
      // 最大保存数を超えたら古いものを削除
      if (errorLogs.length > this.MAX_ERROR_LOGS) {
        errorLogs.splice(this.MAX_ERROR_LOGS);
      }
      
      // 保存
      await chrome.storage.local.set({ errorLogs });
      console.error('Error logged:', errorLog);
    } catch (saveError) {
      console.error('Failed to save error log:', saveError);
    }
  }
};

// グローバルエラーハンドラー
window.addEventListener('error', (event) => {
  ErrorLogger.saveError({
    message: event.message,
    stack: `${event.filename}:${event.lineno}:${event.colno}`,
    error: event.error
  });
});

// Promise rejection ハンドラー
window.addEventListener('unhandledrejection', (event) => {
  ErrorLogger.saveError({
    message: `Unhandled Promise Rejection: ${event.reason}`,
    stack: event.reason?.stack || ''
  });
});

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadGroups();
    await loadCalendars();
    renderGroupList();
    setupEventListeners();
  } catch (error) {
    console.error('初期化エラー:', error);
    ErrorLogger.saveError(error, 'popup-init');
    showMessage('初期化に失敗しました。ページをリロードしてください。', 'error');
  }
});

// イベントリスナーの設定
function setupEventListeners() {
  document.getElementById('createGroup').addEventListener('click', createGroup);
  document.getElementById('cancelEdit').addEventListener('click', cancelEdit);
  document.getElementById('memberInput').addEventListener('input', handleMemberInput);
  document.getElementById('memberInput').addEventListener('keydown', handleKeyDown);
  document.getElementById('copyDebugInfo').addEventListener('click', copyDebugInfo);
  document.getElementById('copyErrorLogs').addEventListener('click', copyErrorLogs);
  document.getElementById('showMyCalendarOnly').addEventListener('click', showMyCalendarOnly);
  
  // バックアップ・復元機能
  document.getElementById('exportSettings').addEventListener('click', exportSettings);
  document.getElementById('importSettingsBtn').addEventListener('click', () => {
    document.getElementById('importSettings').click();
  });
  document.getElementById('importSettings').addEventListener('change', importSettings);
  
  // クリックでオートコンプリートを閉じる
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.member-input-container')) {
      hideAutocomplete();
    }
  });
}

// 保存済みグループの読み込み
async function loadGroups() {
  const result = await chrome.storage.local.get(['calendarGroups']);
  groups = result.calendarGroups || [];
}

// カレンダーリストの読み込み
async function loadCalendars() {
  try {
    // content.jsからカレンダーリストを取得
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    if (!tabs || tabs.length === 0) {
      console.error('アクティブなタブが見つかりません');
      return;
    }
    
    if (tabs[0].url && tabs[0].url.includes('calendar.google.com')) {
      try {
        // タブがまだ読み込み中の場合は少し待つ
        if (tabs[0].status !== 'complete') {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        const response = await chrome.tabs.sendMessage(tabs[0].id, {action: 'getCalendars'});
        if (response && response.calendars) {
          allCalendars = response.calendars;
        }
      } catch (error) {
        console.error('カレンダーリストの取得に失敗:', error);
        // エラーを無視して続行（オートコンプリートが使えないだけ）
      }
    }
  } catch (error) {
    console.error('タブクエリエラー:', error);
  }
}

// グループリストの表示
function renderGroupList() {
  const groupListElement = document.getElementById('groupList');
  
  if (groups.length === 0) {
    groupListElement.innerHTML = '<p style="color: #5f6368; text-align: center;">保存済みグループはありません</p>';
    return;
  }
  
  groupListElement.innerHTML = groups.map((group, index) => {
    const isExpanded = expandedGroups.has(index);
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
            <div class="group-name">${escapeHtml(group.name)}</div>
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
              ${escapeHtml(member)}
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `}).join('');
  
  // イベントリスナーを設定
  document.querySelectorAll('.group-info').forEach(info => {
    info.addEventListener('click', (e) => {
      // ボタンのクリックは除外
      if (!e.target.closest('.group-actions')) {
        const index = parseInt(info.dataset.index);
        toggleGroupExpansion(index);
      }
    });
  });
  
  document.querySelectorAll('.apply-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      applyGroup(index);
    });
  });
  
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      editGroup(index);
    });
  });
  
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      deleteGroup(index);
    });
  });
  
  // ドラッグ＆ドロップのイベントリスナー
  setupDragAndDrop();
}

// 編集をキャンセル
function cancelEdit() {
  editingGroupIndex = null;
  
  // フォームをクリア
  document.getElementById('groupName').value = '';
  document.getElementById('memberInput').value = '';
  
  // ボタンとタイトルを元に戻す
  document.getElementById('createGroup').textContent = 'グループ作成';
  document.querySelector('.create-section h3').textContent = '新規グループ作成';
  document.getElementById('cancelEdit').style.display = 'none';
  
  showMessage('編集をキャンセルしました', 'success');
}

// グループの作成
async function createGroup() {
  const nameInput = document.getElementById('groupName');
  const memberInput = document.getElementById('memberInput');
  
  const name = nameInput.value.trim();
  const members = memberInput.value.split('\n').map(m => m.trim()).filter(m => m);
  
  if (!name || members.length === 0) {
    showMessage('グループ名とメンバーを入力してください', 'error');
    return;
  }
  
  if (editingGroupIndex !== null) {
    // 編集モード
    groups[editingGroupIndex] = { name, members };
    showMessage('グループを更新しました', 'success');
    cancelEdit();
  } else {
    // 新規作成モード
    groups.push({ name, members });
    showMessage('グループを作成しました', 'success');
    nameInput.value = '';
    memberInput.value = '';
  }
  
  await chrome.storage.local.set({ calendarGroups: groups });
  renderGroupList();
}

// グループの適用
async function applyGroup(index) {
  const group = groups[index];
  
  // content.jsにメッセージを送信してカレンダーを切り替え
  const tabs = await chrome.tabs.query({active: true, currentWindow: true});
  if (tabs[0].url.includes('calendar.google.com')) {
    try {
      const response = await chrome.tabs.sendMessage(tabs[0].id, {
        action: 'applyGroup',
        members: group.members
      });
      
      if (response && response.success) {
        showMessage(`"${group.name}" を適用しました`, 'success');
        
        // ポップアップを自動で閉じる
        setTimeout(() => {
          window.close();
        }, 1000);
      } else {
        showMessage('適用に失敗しました', 'error');
      }
    } catch (error) {
      console.error('適用エラー:', error);
      showMessage('適用に失敗しました', 'error');
    }
  }
}

// グループの編集
function editGroup(index) {
  const group = groups[index];
  
  // 編集モードに切り替え
  editingGroupIndex = index;
  
  // フォームに値を設定
  document.getElementById('groupName').value = group.name;
  document.getElementById('memberInput').value = group.members.join('\n');
  
  // ボタンとタイトルを変更
  document.getElementById('createGroup').textContent = 'グループ更新';
  document.querySelector('.create-section h3').textContent = 'グループ編集';
  document.getElementById('cancelEdit').style.display = 'inline-block';
  
  // 作成セクションまでスクロール
  document.querySelector('.create-section').scrollIntoView({ behavior: 'smooth' });
  
  showMessage(`"${group.name}" を編集中`, 'success');
}

// グループの削除
async function deleteGroup(index) {
  const group = groups[index];
  if (confirm(`グループ "${group.name}" を削除しますか？`)) {
    groups.splice(index, 1);
    await chrome.storage.local.set({ calendarGroups: groups });
    renderGroupList();
    showMessage('グループを削除しました', 'success');
  }
}

// オートコンプリート機能
function handleMemberInput(e) {
  const input = e.target;
  const lines = input.value.split('\n');
  const currentLine = lines[lines.length - 1];
  
  if (currentLine.length < 1) {
    hideAutocomplete();
    return;
  }
  
  const matches = allCalendars.filter(cal => 
    cal.toLowerCase().includes(currentLine.toLowerCase())
  );
  
  if (matches.length > 0) {
    showAutocomplete(matches, currentLine);
  } else {
    hideAutocomplete();
  }
}

// オートコンプリートの表示
function showAutocomplete(matches, currentInput) {
  const list = document.getElementById('autocompleteList');
  list.innerHTML = matches.map(match => 
    `<div class="autocomplete-item" data-value="${escapeHtml(match)}">${escapeHtml(match)}</div>`
  ).join('');
  
  list.style.display = 'block';
  
  // クリックイベントの設定
  list.querySelectorAll('.autocomplete-item').forEach(item => {
    item.addEventListener('click', () => {
      selectAutocompleteItem(item.dataset.value);
    });
  });
}

// オートコンプリートの非表示
function hideAutocomplete() {
  document.getElementById('autocompleteList').style.display = 'none';
}

// オートコンプリート項目の選択
function selectAutocompleteItem(value) {
  const input = document.getElementById('memberInput');
  const lines = input.value.split('\n');
  lines[lines.length - 1] = value;
  input.value = lines.join('\n') + '\n';
  input.focus();
  hideAutocomplete();
}

// キーボード操作
function handleKeyDown(e) {
  const list = document.getElementById('autocompleteList');
  const items = list.querySelectorAll('.autocomplete-item');
  const selected = list.querySelector('.autocomplete-item.selected');
  
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    
    if (items.length === 0) return;
    
    let index = Array.from(items).indexOf(selected);
    
    if (e.key === 'ArrowDown') {
      index = index < items.length - 1 ? index + 1 : 0;
    } else {
      index = index > 0 ? index - 1 : items.length - 1;
    }
    
    items.forEach(item => item.classList.remove('selected'));
    items[index].classList.add('selected');
    items[index].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter' && selected) {
    e.preventDefault();
    selectAutocompleteItem(selected.dataset.value);
  } else if (e.key === 'Escape') {
    hideAutocomplete();
  }
}

// メッセージの表示
function showMessage(text, type) {
  const messageElement = document.getElementById('message');
  messageElement.textContent = text;
  messageElement.className = `message ${type}`;
  
  setTimeout(() => {
    messageElement.className = 'message';
  }, 3000);
}

// 自分のカレンダーのみを表示
async function showMyCalendarOnly() {
  const tabs = await chrome.tabs.query({active: true, currentWindow: true});
  if (tabs[0].url.includes('calendar.google.com')) {
    try {
      const response = await chrome.tabs.sendMessage(tabs[0].id, {
        action: 'showMyCalendarOnly'
      });
      
      if (response && response.success) {
        showMessage('自分のカレンダーのみを表示しました', 'success');
        
        // ポップアップを自動で閉じる
        setTimeout(() => {
          window.close();
        }, 1000);
      } else {
        showMessage('操作に失敗しました', 'error');
      }
    } catch (error) {
      console.error('エラー:', error);
      showMessage('操作に失敗しました', 'error');
    }
  }
}

// ドラッグ＆ドロップの設定
let draggedElement = null;
let draggedIndex = null;

function setupDragAndDrop() {
  const items = document.querySelectorAll('.group-item');
  
  items.forEach(item => {
    item.addEventListener('dragstart', handleDragStart);
    item.addEventListener('dragenter', handleDragEnter);
    item.addEventListener('dragover', handleDragOver);
    item.addEventListener('dragleave', handleDragLeave);
    item.addEventListener('drop', handleDrop);
    item.addEventListener('dragend', handleDragEnd);
  });
}

function handleDragStart(e) {
  draggedElement = this;
  draggedIndex = parseInt(this.dataset.index);
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragEnter(e) {
  if (this !== draggedElement) {
    this.classList.add('drag-over');
  }
}

function handleDragOver(e) {
  if (e.preventDefault) {
    e.preventDefault();
  }
  e.dataTransfer.dropEffect = 'move';
  return false;
}

function handleDragLeave(e) {
  this.classList.remove('drag-over');
}

function handleDrop(e) {
  if (e.stopPropagation) {
    e.stopPropagation();
  }
  
  const dropIndex = parseInt(this.dataset.index);
  
  if (draggedElement !== this) {
    // 配列内で要素を移動
    const [movedGroup] = groups.splice(draggedIndex, 1);
    groups.splice(dropIndex, 0, movedGroup);
    
    // 保存して再描画
    chrome.storage.local.set({ calendarGroups: groups }).then(() => {
      renderGroupList();
    });
  }
  
  return false;
}

function handleDragEnd(e) {
  const items = document.querySelectorAll('.group-item');
  items.forEach(item => {
    item.classList.remove('drag-over', 'dragging');
  });
}

// グループの展開/折りたたみ
function toggleGroupExpansion(index) {
  if (expandedGroups.has(index)) {
    expandedGroups.delete(index);
  } else {
    expandedGroups.add(index);
  }
  renderGroupList();
}

// HTMLエスケープ
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// デバッグ情報を取得
async function getDebugInfo() {
  try {
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    
    if (!tabs[0].url.includes('calendar.google.com')) {
      return 'エラー: Googleカレンダーのページではありません';
    }
    
    // カレンダーリストを取得
    let calendarsInfo = '取得失敗';
    try {
      const response = await chrome.tabs.sendMessage(tabs[0].id, {action: 'getCalendars'});
      if (response && response.calendars) {
        calendarsInfo = `取得成功: ${response.calendars.length}個\n` + 
                       response.calendars.slice(0, 5).join('\n') + 
                       (response.calendars.length > 5 ? '\n...' : '');
      }
    } catch (e) {
      calendarsInfo = 'エラー: ' + e.message;
    }
    
    // DOM構造を確認
    const [domInfo] = await chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      function: () => {
        const checkboxes = document.querySelectorAll('input[type="checkbox"][aria-label]');
        const info = {
          checkboxCount: checkboxes.length,
          samples: []
        };
        
        checkboxes.forEach((cb, index) => {
          if (index < 3) {
            info.samples.push({
              ariaLabel: cb.getAttribute('aria-label'),
              checked: cb.checked,
              id: cb.id || 'なし'
            });
          }
        });
        
        return info;
      }
    });
    
    const debugInfo = `=== デバッグ情報 ===

【カレンダーリスト】
${calendarsInfo}

【チェックボックス情報】
総数: ${domInfo.result.checkboxCount}個

【サンプル（最初の3個）】
${domInfo.result.samples.map((s, i) => `
${i + 1}. aria-label: "${s.ariaLabel}"
   checked: ${s.checked}
   id: ${s.id}
`).join('')}

【使用方法】
カレンダー名は「マイカレンダー」および
「他のカレンダー」に表示されている名前を
そのまま使用してください。
例: "Shintaro Okamura"`;
    
    return debugInfo;
    
  } catch (error) {
    return `エラー: ${error.message}\n\nGoogleカレンダーのページをリロードしてから再度お試しください。`;
  }
}

// デバッグ情報をクリップボードにコピー
async function copyDebugInfo() {
  try {
    showMessage('デバッグ情報を取得中...', 'info');
    const debugInfo = await getDebugInfo();
    
    await navigator.clipboard.writeText(debugInfo);
    showMessage('デバッグ情報をコピーしました', 'success');
  } catch (error) {
    // フォールバック: テキストエリアを使用
    try {
      const debugInfo = await getDebugInfo();
      const textarea = document.createElement('textarea');
      textarea.value = debugInfo;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showMessage('デバッグ情報をコピーしました', 'success');
    } catch (e) {
      showMessage('コピーに失敗しました', 'error');
      ErrorLogger.saveError(e, 'popup-copy-debug');
    }
  }
}

// 設定のエクスポート
async function exportSettings() {
  try {
    const result = await chrome.storage.local.get(['calendarGroups']);
    const groups = result.calendarGroups || [];
    
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      groups: groups
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const a = document.createElement('a');
    a.href = URL.createObjectURL(dataBlob);
    a.download = `gcal-groups-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    showMessage('設定をエクスポートしました', 'success');
  } catch (error) {
    console.error('エクスポートエラー:', error);
    showMessage('エクスポートに失敗しました', 'error');
  }
}

// 設定のインポート
async function importSettings(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const importData = JSON.parse(text);
    
    // データの検証
    if (!importData.version || !importData.groups || !Array.isArray(importData.groups)) {
      throw new Error('無効なバックアップファイルです');
    }
    
    // 確認ダイアログ
    const groupCount = importData.groups.length;
    const confirmMessage = `${groupCount}個のグループをインポートします。\n現在の設定は上書きされます。続行しますか？`;
    
    if (!confirm(confirmMessage)) {
      event.target.value = ''; // ファイル選択をリセット
      return;
    }
    
    // グループをインポート
    await chrome.storage.local.set({ calendarGroups: importData.groups });
    groups = importData.groups;
    
    // UIを更新
    renderGroupList();
    showMessage(`${groupCount}個のグループをインポートしました`, 'success');
    
    // ファイル選択をリセット
    event.target.value = '';
  } catch (error) {
    console.error('インポートエラー:', error);
    showMessage('インポートに失敗しました: ' + error.message, 'error');
    event.target.value = ''; // ファイル選択をリセット
  }
}

// エラーログをクリップボードにコピー
async function copyErrorLogs() {
  console.log('copyErrorLogs called');
  try {
    showMessage('エラーログを取得中...', 'info');
    
    const result = await chrome.storage.local.get(['errorLogs']);
    console.log('Storage result:', result);
    const errorLogs = result.errorLogs || [];
    console.log('Error logs count:', errorLogs.length);
    
    let logText = '=== エラーログ ===\n\n';
    
    if (errorLogs.length === 0) {
      logText += 'エラーログはありません';
      console.log('No error logs found, showing message');
      showMessage('エラーログはありません', 'info');
      return;
    } else {
      logText += `合計 ${errorLogs.length} 件のエラー\n\n`;
      
      errorLogs.forEach((log, index) => {
        const date = new Date(log.timestamp);
        const timeStr = date.toLocaleString('ja-JP');
        
        logText += `--- エラー ${index + 1} ---\n`;
        logText += `時刻: ${timeStr}\n`;
        logText += `コンテキスト: ${log.context}\n`;
        logText += `メッセージ: ${log.message}\n`;
        if (log.stack) {
          logText += `スタック: ${log.stack}\n`;
        }
        if (log.url) {
          logText += `URL: ${log.url}\n`;
        }
        logText += '\n';
      });
    }
    
    await navigator.clipboard.writeText(logText);
    showMessage('エラーログをコピーしました', 'success');
  } catch (error) {
    console.error('Clipboard API failed:', error);
    // フォールバック: テキストエリアを使用
    try {
      const result = await chrome.storage.local.get(['errorLogs']);
      const errorLogs = result.errorLogs || [];
      let logText = '=== エラーログ ===\n\n';
      
      if (errorLogs.length === 0) {
        logText += 'エラーログはありません';
        showMessage('エラーログはありません', 'info');
        return;
      } else {
        logText += `合計 ${errorLogs.length} 件のエラー\n\n`;
        errorLogs.forEach((log, index) => {
          const date = new Date(log.timestamp);
          const timeStr = date.toLocaleString('ja-JP');
          logText += `--- エラー ${index + 1} ---\n`;
          logText += `時刻: ${timeStr}\n`;
          logText += `コンテキスト: ${log.context}\n`;
          logText += `メッセージ: ${log.message}\n`;
          if (log.stack) logText += `スタック: ${log.stack}\n`;
          if (log.url) logText += `URL: ${log.url}\n`;
          logText += '\n';
        });
      }
      
      const textarea = document.createElement('textarea');
      textarea.value = logText;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showMessage('エラーログをコピーしました', 'success');
    } catch (e) {
      showMessage('コピーに失敗しました', 'error');
      ErrorLogger.saveError(e, 'popup-copy-error-logs');
    }
  }
}

// HTMLエスケープ
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// グローバルスコープに関数を設定
window.applyGroup = applyGroup;
window.deleteGroup = deleteGroup;
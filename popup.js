// グループデータの管理
let groups = [];
let allCalendars = [];
let lastDebugInfo = '';

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadGroups();
    await loadCalendars();
    renderGroupList();
    setupEventListeners();
  } catch (error) {
    console.error('初期化エラー:', error);
    showMessage('初期化に失敗しました。ページをリロードしてください。', 'error');
  }
});

// イベントリスナーの設定
function setupEventListeners() {
  document.getElementById('createGroup').addEventListener('click', createGroup);
  document.getElementById('memberInput').addEventListener('input', handleMemberInput);
  document.getElementById('memberInput').addEventListener('keydown', handleKeyDown);
  document.getElementById('showDebugInfo').addEventListener('click', showDebugInfo);
  document.getElementById('copyDebugInfo').addEventListener('click', copyDebugInfo);
  document.getElementById('showMyCalendarOnly').addEventListener('click', showMyCalendarOnly);
  
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
  
  groupListElement.innerHTML = groups.map((group, index) => `
    <div class="group-item" data-index="${index}">
      <div>
        <div class="group-name">${escapeHtml(group.name)}</div>
        <div class="group-members">${group.members.length}人: ${escapeHtml(group.members.slice(0, 3).join(', '))}${group.members.length > 3 ? '...' : ''}</div>
      </div>
      <div class="group-actions">
        <button class="btn btn-primary btn-small apply-btn" data-index="${index}">適用</button>
        <button class="btn btn-danger btn-small delete-btn" data-index="${index}">削除</button>
      </div>
    </div>
  `).join('');
  
  // イベントリスナーを設定
  document.querySelectorAll('.apply-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      applyGroup(index);
    });
  });
  
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      deleteGroup(index);
    });
  });
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
  
  groups.push({ name, members });
  await chrome.storage.local.set({ calendarGroups: groups });
  
  nameInput.value = '';
  memberInput.value = '';
  
  renderGroupList();
  showMessage('グループを作成しました', 'success');
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

// HTMLエスケープ
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// デバッグ情報を表示
async function showDebugInfo() {
  const debugDiv = document.getElementById('debugInfo');
  const copyButton = document.getElementById('copyDebugInfo');
  debugDiv.style.display = 'block';
  debugDiv.innerHTML = 'デバッグ情報を取得中...';
  
  try {
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    
    if (!tabs[0].url.includes('calendar.google.com')) {
      debugDiv.innerHTML = 'エラー: Googleカレンダーのページではありません';
      return;
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
カレンダー名はaria-labelの値を
そのまま使用してください。
例: "Shintaro Okamura"`;
    
    debugDiv.innerHTML = debugInfo;
    lastDebugInfo = debugInfo;
    copyButton.style.display = 'block';
    
  } catch (error) {
    const errorInfo = `エラー: ${error.message}\n\nGoogleカレンダーのページをリロードしてから再度お試しください。`;
    debugDiv.innerHTML = errorInfo;
    lastDebugInfo = errorInfo;
    copyButton.style.display = 'block';
  }
}

// デバッグ情報をクリップボードにコピー
async function copyDebugInfo() {
  try {
    await navigator.clipboard.writeText(lastDebugInfo);
    showMessage('デバッグ情報をコピーしました', 'success');
  } catch (error) {
    // フォールバック: テキストエリアを使用
    const textarea = document.createElement('textarea');
    textarea.value = lastDebugInfo;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
      document.execCommand('copy');
      showMessage('デバッグ情報をコピーしました', 'success');
    } catch (e) {
      showMessage('コピーに失敗しました', 'error');
    }
    
    document.body.removeChild(textarea);
  }
}

// グローバルスコープに関数を設定
window.applyGroup = applyGroup;
window.deleteGroup = deleteGroup;
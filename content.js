// Googleカレンダーのカレンダーリストを取得・操作するスクリプト

// エラーログ管理
const ErrorLogger = {
  // エラーログの最大保存数
  MAX_ERROR_LOGS: 100,
  
  // エラーをストレージに保存
  async saveError(error, context = 'content') {
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

// メッセージリスナーの設定
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request);
  
  try {
    if (request.action === 'getCalendars') {
      const calendars = getCalendarList();
      sendResponse({ calendars });
    } else if (request.action === 'applyGroup') {
      applyGroupToCalendars(request.members);
      sendResponse({ success: true });
    } else if (request.action === 'showMyCalendarOnly') {
      showOnlyMyCalendar();
      sendResponse({ success: true });
    }
  } catch (error) {
    console.error('Error in message handler:', error);
    ErrorLogger.saveError(error, `content-message-${request.action}`);
    sendResponse({ error: error.message });
  }
  return true;
});

// カレンダーリストの取得
function getCalendarList() {
  const calendars = [];
  
  // チェックボックスのaria-labelから取得（最もシンプルで確実）
  const checkboxes = document.querySelectorAll('input[type="checkbox"][aria-label]');
  checkboxes.forEach(checkbox => {
    const label = checkbox.getAttribute('aria-label');
    if (label && label.trim()) {
      const name = label.trim();
      if (!calendars.includes(name)) {
        calendars.push(name);
      }
    }
  });
  
  console.log('Found calendars:', calendars);
  return calendars;
}

// グループメンバーのカレンダーを適用
function applyGroupToCalendars(members) {
  console.log('Applying group with members:', members);
  
  // まず全てのカレンダーのチェックを外す
  uncheckAllCalendars();
  
  // 少し待ってから指定されたメンバーのカレンダーにチェックを入れる
  setTimeout(() => {
    let checkedCount = 0;
    members.forEach(member => {
      const result = checkCalendar(member);
      if (result) checkedCount++;
    });
    console.log(`Checked ${checkedCount} out of ${members.length} calendars`);
  }, 200);
}

// 全てのカレンダーのチェックを外す
function uncheckAllCalendars() {
  console.log('Unchecking all calendars...');
  const checkboxes = document.querySelectorAll('input[type="checkbox"][aria-label]:checked');
  let count = 0;
  checkboxes.forEach(checkbox => {
    checkbox.click();
    count++;
  });
  console.log(`Unchecked ${count} calendars`);
}

// 特定のカレンダーにチェックを入れる
function checkCalendar(calendarName) {
  console.log('Trying to check calendar:', calendarName);
  let found = false;
  
  // シンプルにaria-labelで検索
  const checkboxes = document.querySelectorAll('input[type="checkbox"][aria-label]');
  checkboxes.forEach(checkbox => {
    const label = checkbox.getAttribute('aria-label');
    if (label && label.trim() === calendarName.trim()) {
      if (!checkbox.checked) {
        checkbox.click();
        console.log('Checked calendar:', calendarName);
        found = true;
      } else {
        console.log('Calendar already checked:', calendarName);
        found = true;
      }
    }
  });
  
  if (!found) {
    console.log('Calendar not found:', calendarName);
  }
  return found;
}

// 自分のカレンダーのみを表示
function showOnlyMyCalendar() {
  console.log('Showing only my calendar...');
  
  // まず全てのカレンダーのチェックを外す
  uncheckAllCalendars();
  
  // 少し待ってから最初のカレンダーにチェックを入れる
  setTimeout(() => {
    // 方法1: 最初のチェックボックスを探す（通常は自分のカレンダー）
    const firstCheckbox = document.querySelector('input[type="checkbox"][aria-label]');
    if (firstCheckbox && !firstCheckbox.checked) {
      firstCheckbox.click();
      console.log('Checked first calendar (my calendar)');
      return;
    }
    
    // 方法2: "マイカレンダー"セクションの最初の項目を探す
    const myCalendarSection = document.querySelector('[role="heading"][aria-label*="マイカレンダー"], [role="heading"][aria-label*="My calendars"]');
    if (myCalendarSection) {
      const parentElement = myCalendarSection.parentElement;
      const firstCalendarItem = parentElement.querySelector('input[type="checkbox"][aria-label]');
      if (firstCalendarItem && !firstCalendarItem.checked) {
        firstCalendarItem.click();
        console.log('Checked my calendar from My calendars section');
        return;
      }
    }
    
    // 方法3: リストの最初の項目を探す
    const allCheckboxes = document.querySelectorAll('input[type="checkbox"][aria-label]');
    if (allCheckboxes.length > 0 && !allCheckboxes[0].checked) {
      allCheckboxes[0].click();
      console.log('Checked first available calendar');
    }
  }, 200);
}

// ページ読み込み完了時の処理
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function init() {
  console.log('Calendar Group Manager: Content script loaded');
}
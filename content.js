// Googleカレンダーのカレンダーリストを取得・操作するスクリプト

// メッセージリスナーの設定
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request);
  
  if (request.action === 'getCalendars') {
    const calendars = getCalendarList();
    sendResponse({ calendars });
  } else if (request.action === 'applyGroup') {
    applyGroupToCalendars(request.members);
    sendResponse({ success: true });
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

// ページ読み込み完了時の処理
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function init() {
  console.log('Calendar Group Manager: Content script loaded');
}
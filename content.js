// Googleカレンダーのカレンダーリストを取得・操作するスクリプト

// メッセージリスナーの設定
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request);
  
  // 非同期処理のためのラッパー
  (async () => {
    try {
      if (request.action === 'getCalendars') {
        const calendars = await getCalendarList();
        sendResponse({ success: true, calendars });
      } else if (request.action === 'applyGroup') {
        await applyGroupToCalendars(request.members);
        sendResponse({ success: true });
      } else if (request.action === 'showMyCalendarOnly') {
        await showOnlyMyCalendar();
        sendResponse({ success: true });
      } else {
        throw new Error(`Unknown action: ${request.action}`);
      }
    } catch (error) {
      ErrorHandler.logError(error);
      sendResponse({ 
        success: false, 
        error: error.message || 'エラーが発生しました' 
      });
    }
  })();
  
  return true; // 非同期レスポンスのため
});

// カレンダーリストの取得
async function getCalendarList() {
  try {
    const calendars = [];
    
    // チェックボックスのaria-labelから取得（最もシンプルで確実）
    const checkboxes = document.querySelectorAll('input[type="checkbox"][aria-label]');
    
    if (checkboxes.length === 0) {
      throw ErrorHandler.handleDomError(
        new Error('カレンダーのチェックボックスが見つかりません'),
        'input[type="checkbox"][aria-label]'
      );
    }
    
    checkboxes.forEach(checkbox => {
      try {
        const label = checkbox.getAttribute('aria-label');
        if (label && label.trim()) {
          const name = label.trim();
          if (!calendars.includes(name)) {
            calendars.push(name);
          }
        }
      } catch (error) {
        ErrorHandler.logError(new Error(`チェックボックスの処理中にエラー: ${error.message}`));
      }
    });
    
    console.log('Found calendars:', calendars);
    return calendars;
  } catch (error) {
    ErrorHandler.logError(error);
    return [];
  }
}

// グループメンバーのカレンダーを適用
async function applyGroupToCalendars(members) {
  try {
    console.log('Applying group with members:', members);
    
    if (!members || members.length === 0) {
      throw new Error('メンバーが指定されていません');
    }
    
    // まず全てのカレンダーのチェックを外す
    await uncheckAllCalendars();
    
    // 少し待ってから指定されたメンバーのカレンダーにチェックを入れる
    await new Promise(resolve => setTimeout(resolve, 200));
    
    let checkedCount = 0;
    const errors = [];
    
    for (const member of members) {
      try {
        const result = await checkCalendar(member);
        if (result) checkedCount++;
      } catch (error) {
        errors.push(`${member}: ${error.message}`);
      }
    }
    
    console.log(`Checked ${checkedCount} out of ${members.length} calendars`);
    
    if (checkedCount === 0) {
      throw new Error('指定されたカレンダーが見つかりませんでした');
    }
    
    if (errors.length > 0) {
      ErrorHandler.logError(new Error(`一部のカレンダーでエラー: ${errors.join(', ')}`));
    }
  } catch (error) {
    throw ErrorHandler.handleDomError(error);
  }
}

// 全てのカレンダーのチェックを外す
async function uncheckAllCalendars() {
  try {
    console.log('Unchecking all calendars...');
    const checkboxes = document.querySelectorAll('input[type="checkbox"][aria-label]:checked');
    let count = 0;
    
    for (const checkbox of checkboxes) {
      try {
        if (checkbox.disabled) {
          console.warn('チェックボックスが無効化されています:', checkbox.getAttribute('aria-label'));
          continue;
        }
        checkbox.click();
        count++;
        // 連続クリックによる問題を防ぐため少し待つ
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        ErrorHandler.logError(new Error(`チェックボックスのクリックに失敗: ${error.message}`));
      }
    }
    
    console.log(`Unchecked ${count} calendars`);
  } catch (error) {
    throw ErrorHandler.handleDomError(error, 'input[type="checkbox"][aria-label]:checked');
  }
}

// 特定のカレンダーにチェックを入れる
async function checkCalendar(calendarName) {
  try {
    console.log('Trying to check calendar:', calendarName);
    let found = false;
    
    // シンプルにaria-labelで検索
    const checkboxes = document.querySelectorAll('input[type="checkbox"][aria-label]');
    
    for (const checkbox of checkboxes) {
      try {
        const label = checkbox.getAttribute('aria-label');
        if (label && label.trim() === calendarName.trim()) {
          if (checkbox.disabled) {
            throw new Error(`カレンダー「${calendarName}」は無効化されています`);
          }
          
          if (!checkbox.checked) {
            checkbox.click();
            console.log('Checked calendar:', calendarName);
            found = true;
          } else {
            console.log('Calendar already checked:', calendarName);
            found = true;
          }
          break;
        }
      } catch (error) {
        throw error; // 個別のエラーは上位に伝播
      }
    }
    
    if (!found) {
      console.log('Calendar not found:', calendarName);
    }
    return found;
  } catch (error) {
    throw ErrorHandler.handleDomError(error, `Calendar: ${calendarName}`);
  }
}

// 自分のカレンダーのみを表示
async function showOnlyMyCalendar() {
  try {
    console.log('Showing only my calendar...');
    
    // まず全てのカレンダーのチェックを外す
    await uncheckAllCalendars();
    
    // 少し待ってから最初のカレンダーにチェックを入れる
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const success = await (async () => {
      // 方法1: 最初のチェックボックスを探す（通常は自分のカレンダー）
      const firstCheckbox = document.querySelector('input[type="checkbox"][aria-label]');
      if (firstCheckbox && !firstCheckbox.checked && !firstCheckbox.disabled) {
        firstCheckbox.click();
        console.log('Checked first calendar (my calendar)');
        return true;
      }
    
      // 方法2: "マイカレンダー"セクションの最初の項目を探す
      const myCalendarSection = document.querySelector('[role="heading"][aria-label*="マイカレンダー"], [role="heading"][aria-label*="My calendars"]');
      if (myCalendarSection) {
        const parentElement = myCalendarSection.parentElement;
        const firstCalendarItem = parentElement.querySelector('input[type="checkbox"][aria-label]');
        if (firstCalendarItem && !firstCalendarItem.checked && !firstCalendarItem.disabled) {
          firstCalendarItem.click();
          console.log('Checked my calendar from My calendars section');
          return true;
        }
      }
    
      // 方法3: リストの最初の項目を探す
      const allCheckboxes = document.querySelectorAll('input[type="checkbox"][aria-label]');
      if (allCheckboxes.length > 0 && !allCheckboxes[0].checked && !allCheckboxes[0].disabled) {
        allCheckboxes[0].click();
        console.log('Checked first available calendar');
        return true;
      }
      
      return false;
    })();
    
    if (!success) {
      throw new Error('自分のカレンダーが見つかりませんでした');
    }
  } catch (error) {
    throw ErrorHandler.handleDomError(error, 'My calendar');
  }
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
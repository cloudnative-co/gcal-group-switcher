// バックグラウンドサービスワーカー
// 拡張機能の安定性を向上させる

// エラーログ管理
const ErrorLogger = {
  // エラーログの最大保存数
  MAX_ERROR_LOGS: 100,
  
  // エラーをストレージに保存
  async saveError(error, context = 'background') {
    try {
      const errorLog = {
        timestamp: new Date().toISOString(),
        context: context,
        message: error.message || String(error),
        stack: error.stack || '',
        url: self.location?.href || 'background',
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
self.addEventListener('error', (event) => {
  ErrorLogger.saveError({
    message: event.message,
    stack: `${event.filename}:${event.lineno}:${event.colno}`,
    error: event.error
  });
});

// Promise rejection ハンドラー
self.addEventListener('unhandledrejection', (event) => {
  ErrorLogger.saveError({
    message: `Unhandled Promise Rejection: ${event.reason}`,
    stack: event.reason?.stack || ''
  });
});

// 拡張機能のインストール時の処理
chrome.runtime.onInstalled.addListener(() => {
  console.log('Google Calendar Group Switcher がインストールされました');
});

// エラーハンドリング
chrome.runtime.onConnect.addListener((port) => {
  port.onDisconnect.addListener(() => {
    if (chrome.runtime.lastError) {
      console.log('Port disconnected:', chrome.runtime.lastError.message);
      ErrorLogger.saveError({
        message: `Port disconnected: ${chrome.runtime.lastError.message}`,
        stack: ''
      });
    }
  });
});

// Chrome API エラーをキャッチする関数
function checkChromeError(context) {
  if (chrome.runtime.lastError) {
    ErrorLogger.saveError({
      message: `Chrome API Error in ${context}: ${chrome.runtime.lastError.message}`,
      stack: ''
    });
    return true;
  }
  return false;
}

// タブの更新を監視
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('calendar.google.com')) {
    // Googleカレンダーのページが完全に読み込まれた
    console.log('Googleカレンダーが読み込まれました');
  }
});

// 拡張機能のアイコンクリック時の処理
chrome.action.onClicked.addListener((tab) => {
  // この処理は default_popup が設定されている場合は呼ばれません
  console.log('拡張機能がクリックされました');
});
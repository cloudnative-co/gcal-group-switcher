// バックグラウンドサービスワーカー
// 拡張機能の安定性を向上させる

// 拡張機能のインストール時の処理
chrome.runtime.onInstalled.addListener(() => {
  console.log('Google Calendar Group Switcher がインストールされました');
});

// エラーハンドリング
chrome.runtime.onConnect.addListener((port) => {
  port.onDisconnect.addListener(() => {
    if (chrome.runtime.lastError) {
      console.log('Port disconnected:', chrome.runtime.lastError.message);
    }
  });
});

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
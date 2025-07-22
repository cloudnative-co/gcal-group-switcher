// バックグラウンドサービスワーカー
// 拡張機能の安定性を向上させる

// errorHandler.jsを直接インポートできないため、インライン化
const ErrorHandler = {
  logError(error) {
    const errorInfo = {
      message: error.message || 'Unknown error',
      stack: error.stack,
      timestamp: new Date().toISOString()
    };
    console.error('Background Service Worker Error:', errorInfo);
  },
  
  safeExecute(fn, context = 'unknown') {
    try {
      const result = fn();
      if (result instanceof Promise) {
        return result.catch(error => {
          this.logError(error);
          return null;
        });
      }
      return result;
    } catch (error) {
      this.logError(error);
      return null;
    }
  }
};

// 拡張機能のインストール時の処理
chrome.runtime.onInstalled.addListener((details) => {
  ErrorHandler.safeExecute(() => {
    console.log('Google Calendar Group Switcher がインストールされました');
    console.log('インストール理由:', details.reason);
    
    if (details.reason === 'install') {
      // 初回インストール時の処理
      chrome.storage.local.set({ 
        calendarGroups: [],
        installedAt: new Date().toISOString()
      }).catch(error => {
        ErrorHandler.logError(error);
      });
    } else if (details.reason === 'update') {
      // アップデート時の処理
      console.log('前のバージョン:', details.previousVersion);
    }
  }, 'onInstalled');
});

// エラーハンドリング
chrome.runtime.onConnect.addListener((port) => {
  ErrorHandler.safeExecute(() => {
    console.log('ポート接続:', port.name);
    
    port.onDisconnect.addListener(() => {
      if (chrome.runtime.lastError) {
        ErrorHandler.logError(new Error(`Port disconnected: ${chrome.runtime.lastError.message}`));
      }
    });
    
    // ポートメッセージのエラーハンドリング
    port.onMessage.addListener((message) => {
      ErrorHandler.safeExecute(() => {
        console.log('ポートメッセージ受信:', message);
      }, 'portMessage');
    });
  }, 'onConnect');
});

// タブの更新を監視
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  ErrorHandler.safeExecute(() => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('calendar.google.com')) {
      // Googleカレンダーのページが完全に読み込まれた
      console.log('Googleカレンダーが読み込まれました:', tab.url);
      
      // コンテンツスクリプトの再注入（必要な場合）
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['errorHandler.js', 'content.js']
      }).catch(error => {
        // スクリプトが既に注入されている場合のエラーは無視
        if (!error.message.includes('Cannot access')) {
          ErrorHandler.logError(error);
        }
      });
    }
  }, 'onTabUpdated');
});

// 拡張機能のアイコンクリック時の処理
chrome.action.onClicked.addListener((tab) => {
  ErrorHandler.safeExecute(() => {
    // この処理は default_popup が設定されている場合は呼ばれません
    console.log('拡張機能がクリックされました');
  }, 'onActionClicked');
});

// メッセージリスナー（他のスクリプトからの通信用）
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  ErrorHandler.safeExecute(() => {
    console.log('メッセージ受信:', request, 'from:', sender);
    
    // 非同期処理のためのラッパー
    (async () => {
      try {
        if (request.action === 'logError') {
          ErrorHandler.logError(new Error(request.error));
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'Unknown action' });
        }
      } catch (error) {
        ErrorHandler.logError(error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    
    return true; // 非同期レスポンスのため
  }, 'onMessage');
});

// サービスワーカーの起動時処理
self.addEventListener('activate', (event) => {
  ErrorHandler.safeExecute(() => {
    console.log('Service Worker activated');
    // 古いキャッシュのクリーンアップなど
  }, 'activate');
});

// エラーイベントのグローバルハンドリング
self.addEventListener('error', (event) => {
  ErrorHandler.logError(new Error(`Uncaught error: ${event.message} at ${event.filename}:${event.lineno}`));
});

self.addEventListener('unhandledrejection', (event) => {
  ErrorHandler.logError(new Error(`Unhandled promise rejection: ${event.reason}`));
});
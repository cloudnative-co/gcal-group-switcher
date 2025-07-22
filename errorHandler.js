/**
 * エラーハンドリングユーティリティ
 * 統一的なエラー処理とユーザーフレンドリーなメッセージ表示を提供
 */

// エラータイプの定義
const ErrorTypes = {
  CHROME_API_ERROR: 'CHROME_API_ERROR',
  TAB_NOT_FOUND: 'TAB_NOT_FOUND',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  STORAGE_ERROR: 'STORAGE_ERROR',
  DOM_ERROR: 'DOM_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

// エラーメッセージのマッピング
const ErrorMessages = {
  [ErrorTypes.CHROME_API_ERROR]: {
    default: 'Chrome拡張機能のAPIでエラーが発生しました',
    storage: 'データの保存中にエラーが発生しました',
    tabs: 'タブの操作中にエラーが発生しました',
    runtime: '拡張機能の実行中にエラーが発生しました'
  },
  [ErrorTypes.TAB_NOT_FOUND]: {
    default: 'Googleカレンダーのタブが見つかりません。カレンダーを開いてから再度お試しください'
  },
  [ErrorTypes.PERMISSION_DENIED]: {
    default: '必要な権限がありません。拡張機能の設定を確認してください'
  },
  [ErrorTypes.STORAGE_ERROR]: {
    default: 'データの保存・読み込みに失敗しました',
    quota: 'ストレージの容量が不足しています',
    corrupted: 'データが破損している可能性があります'
  },
  [ErrorTypes.DOM_ERROR]: {
    default: 'ページの要素が見つかりません。ページを再読み込みしてください',
    structure_changed: 'Googleカレンダーの構造が変更された可能性があります'
  },
  [ErrorTypes.NETWORK_ERROR]: {
    default: 'ネットワークエラーが発生しました。インターネット接続を確認してください'
  },
  [ErrorTypes.VALIDATION_ERROR]: {
    default: '入力内容に問題があります',
    empty_name: 'グループ名を入力してください',
    empty_members: 'メンバーを1人以上入力してください',
    duplicate_name: '同じ名前のグループが既に存在します'
  },
  [ErrorTypes.UNKNOWN_ERROR]: {
    default: '予期しないエラーが発生しました'
  }
};

// カスタムエラークラス
class CalendarGroupError extends Error {
  constructor(type, subType = 'default', details = {}) {
    const message = ErrorMessages[type]?.[subType] || ErrorMessages[type]?.default || ErrorMessages[ErrorTypes.UNKNOWN_ERROR].default;
    super(message);
    this.name = 'CalendarGroupError';
    this.type = type;
    this.subType = subType;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  toUserMessage() {
    return this.message;
  }

  toDebugInfo() {
    return {
      type: this.type,
      subType: this.subType,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

// エラーハンドリングヘルパー関数
const ErrorHandler = {
  // Chrome APIエラーのチェックと処理
  checkChromeError(context = 'default') {
    if (chrome.runtime.lastError) {
      const error = new CalendarGroupError(
        ErrorTypes.CHROME_API_ERROR,
        context,
        { chromeError: chrome.runtime.lastError.message }
      );
      console.error('Chrome API Error:', error.toDebugInfo());
      throw error;
    }
  },

  // 非同期Chrome API呼び出しのラッパー
  async wrapChromeApi(apiCall, context = 'default') {
    try {
      const result = await apiCall();
      this.checkChromeError(context);
      return result;
    } catch (error) {
      if (error instanceof CalendarGroupError) {
        throw error;
      }
      throw new CalendarGroupError(
        ErrorTypes.CHROME_API_ERROR,
        context,
        { originalError: error.message }
      );
    }
  },

  // エラーログを保存する配列（最大100件）
  _errorLogs: [],

  // エラーのログ記録
  logError(error) {
    const errorInfo = error instanceof CalendarGroupError 
      ? error.toDebugInfo() 
      : {
          type: ErrorTypes.UNKNOWN_ERROR,
          message: error.message || 'Unknown error',
          stack: error.stack,
          timestamp: new Date().toISOString()
        };

    console.error('Calendar Group Switcher Error:', errorInfo);

    // エラーログを配列に保存（最大100件まで）
    this._errorLogs.unshift(errorInfo);
    if (this._errorLogs.length > 100) {
      this._errorLogs = this._errorLogs.slice(0, 100);
    }

    // デバッグモードの場合、詳細情報も記録
    if (localStorage.getItem('debug_mode') === 'true') {
      console.error('Error Stack:', error.stack);
    }

    // 重要なエラーの場合、バックグラウンドスクリプトに通知
    if (errorInfo.type === ErrorTypes.CHROME_API_ERROR || 
        errorInfo.type === ErrorTypes.STORAGE_ERROR) {
      this.safeExecute(() => {
        chrome.runtime.sendMessage({
          action: 'logError',
          error: errorInfo.message
        });
      });
    }
  },

  // 最近のエラーログを取得
  getRecentErrors(limit = 10) {
    return this._errorLogs.slice(0, limit);
  },

  // エラーログをクリア
  clearErrorLogs() {
    this._errorLogs = [];
  },

  // ユーザーへのエラー表示（popup.js用）
  showUserError(error, showRetryAction = false) {
    // showErrorMessage関数を使用（popup.jsで定義済み）
    if (typeof showErrorMessage === 'function') {
      showErrorMessage(error, showRetryAction);
    } else if (typeof showMessage === 'function') {
      // フォールバック: 古いshowMessage関数
      const message = error instanceof CalendarGroupError 
        ? error.toUserMessage() 
        : 'エラーが発生しました。しばらくしてから再度お試しください。';
      showMessage(message, 'error', 5000);
    } else {
      console.error('showErrorMessage or showMessage function not found:', error.message);
    }
  },

  // バリデーションエラーの生成
  validationError(subType, details = {}) {
    return new CalendarGroupError(ErrorTypes.VALIDATION_ERROR, subType, details);
  },

  // DOM操作エラーの処理
  handleDomError(error, element = null) {
    const details = {
      originalError: error.message,
      element: element ? element.toString() : 'unknown'
    };
    
    if (error.message.includes('Cannot read properties')) {
      return new CalendarGroupError(ErrorTypes.DOM_ERROR, 'structure_changed', details);
    }
    
    return new CalendarGroupError(ErrorTypes.DOM_ERROR, 'default', details);
  },

  // リトライ機能付き実行
  async retryOperation(operation, maxRetries = 3, delay = 1000) {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        this.logError(error);
        
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
        }
      }
    }
    
    throw lastError;
  },

  // 安全な関数実行ラッパー
  safeExecute(fn, fallbackValue = null, context = 'unknown') {
    try {
      const result = fn();
      if (result instanceof Promise) {
        return result.catch(error => {
          this.logError(error);
          return fallbackValue;
        });
      }
      return result;
    } catch (error) {
      this.logError(error);
      return fallbackValue;
    }
  }
};

// エクスポート（Chrome拡張機能用）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ErrorHandler, CalendarGroupError, ErrorTypes };
}
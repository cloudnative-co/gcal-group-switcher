/**
 * ErrorHandler の単体テスト
 */

// テスト対象を読み込む
const fs = require('fs');
const path = require('path');
const errorHandlerCode = fs.readFileSync(
  path.join(__dirname, '../../errorHandler.js'),
  'utf8'
);

// グローバルスコープで実行
eval(errorHandlerCode);

describe('CalendarGroupError', () => {
  test('カスタムエラーを正しく作成', () => {
    const error = new CalendarGroupError(
      ErrorTypes.VALIDATION_ERROR,
      'empty_name',
      { field: 'name' }
    );
    
    expect(error.type).toBe(ErrorTypes.VALIDATION_ERROR);
    expect(error.subType).toBe('empty_name');
    expect(error.details).toEqual({ field: 'name' });
    expect(error.message).toBe('グループ名を入力してください');
    expect(error.name).toBe('CalendarGroupError');
    expect(error.timestamp).toBeDefined();
  });

  test('toUserMessage() でユーザー向けメッセージを取得', () => {
    const error = new CalendarGroupError(ErrorTypes.TAB_NOT_FOUND);
    expect(error.toUserMessage()).toBe('Googleカレンダーのタブが見つかりません。カレンダーを開いてから再度お試しください');
  });

  test('toDebugInfo() でデバッグ情報を取得', () => {
    const error = new CalendarGroupError(
      ErrorTypes.STORAGE_ERROR,
      'quota',
      { used: 5000, limit: 5000 }
    );
    
    const debugInfo = error.toDebugInfo();
    
    expect(debugInfo.type).toBe(ErrorTypes.STORAGE_ERROR);
    expect(debugInfo.subType).toBe('quota');
    expect(debugInfo.message).toBe('ストレージの容量が不足しています');
    expect(debugInfo.details).toEqual({ used: 5000, limit: 5000 });
    expect(debugInfo.timestamp).toBeDefined();
    expect(debugInfo.stack).toBeDefined();
  });
});

describe('ErrorHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ErrorHandler._errorLogs = [];
    chrome.runtime.lastError = null;
  });

  describe('checkChromeError', () => {
    test('Chrome APIエラーがない場合は何もしない', () => {
      chrome.runtime.lastError = null;
      
      expect(() => ErrorHandler.checkChromeError()).not.toThrow();
    });

    test('Chrome APIエラーがある場合は例外をスロー', () => {
      chrome.runtime.lastError = { message: 'Permission denied' };
      
      expect(() => ErrorHandler.checkChromeError('storage')).toThrow(CalendarGroupError);
    });
  });

  describe('wrapChromeApi', () => {
    test('API呼び出しが成功した場合は結果を返す', async () => {
      const mockResult = { data: 'test' };
      const apiCall = jest.fn().mockResolvedValue(mockResult);
      
      const result = await ErrorHandler.wrapChromeApi(apiCall, 'test');
      
      expect(result).toEqual(mockResult);
      expect(apiCall).toHaveBeenCalled();
    });

    test('API呼び出しが失敗した場合はCalendarGroupErrorをスロー', async () => {
      const apiCall = jest.fn().mockRejectedValue(new Error('API Error'));
      
      await expect(ErrorHandler.wrapChromeApi(apiCall, 'test')).rejects.toThrow(CalendarGroupError);
    });
  });

  describe('logError', () => {
    test('エラーログを記録', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new CalendarGroupError(ErrorTypes.NETWORK_ERROR);
      
      ErrorHandler.logError(error);
      
      expect(consoleSpy).toHaveBeenCalled();
      expect(ErrorHandler._errorLogs).toHaveLength(1);
      expect(ErrorHandler._errorLogs[0].type).toBe(ErrorTypes.NETWORK_ERROR);
      
      consoleSpy.mockRestore();
    });

    test('最大100件までのエラーログを保持', () => {
      for (let i = 0; i < 150; i++) {
        ErrorHandler.logError(new Error(`Error ${i}`));
      }
      
      expect(ErrorHandler._errorLogs).toHaveLength(100);
      expect(ErrorHandler._errorLogs[0].message).toBe('Error 149'); // 最新のエラーが最初
    });

    test('重要なエラーはバックグラウンドに通知', () => {
      const error = new CalendarGroupError(ErrorTypes.CHROME_API_ERROR);
      
      ErrorHandler.logError(error);
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'logError',
        error: error.message
      });
    });
  });

  describe('getRecentErrors', () => {
    test('最近のエラーを指定件数取得', () => {
      for (let i = 0; i < 20; i++) {
        ErrorHandler.logError(new Error(`Error ${i}`));
      }
      
      const recentErrors = ErrorHandler.getRecentErrors(5);
      
      expect(recentErrors).toHaveLength(5);
      expect(recentErrors[0].message).toBe('Error 19'); // 最新のエラーが最初
    });
  });

  describe('validationError', () => {
    test('バリデーションエラーを生成', () => {
      const error = ErrorHandler.validationError('empty_name', { field: 'groupName' });
      
      expect(error).toBeInstanceOf(CalendarGroupError);
      expect(error.type).toBe(ErrorTypes.VALIDATION_ERROR);
      expect(error.subType).toBe('empty_name');
      expect(error.details).toEqual({ field: 'groupName' });
    });
  });

  describe('handleDomError', () => {
    test('DOM操作エラーを適切に処理', () => {
      const originalError = new Error("Cannot read properties of null (reading 'click')");
      const error = ErrorHandler.handleDomError(originalError, '#test-element');
      
      expect(error).toBeInstanceOf(CalendarGroupError);
      expect(error.type).toBe(ErrorTypes.DOM_ERROR);
      expect(error.subType).toBe('structure_changed');
      expect(error.details.element).toBe('#test-element');
    });
  });

  describe('retryOperation', () => {
    test('操作が成功した場合は結果を返す', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      
      const result = await ErrorHandler.retryOperation(operation, 3, 100);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    test('操作が失敗した場合はリトライする', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success');
      
      jest.useFakeTimers();
      const promise = ErrorHandler.retryOperation(operation, 3, 100);
      
      // 1回目の失敗後の待機
      await Promise.resolve();
      jest.advanceTimersByTime(100);
      
      // 2回目の失敗後の待機
      await Promise.resolve();
      jest.advanceTimersByTime(200);
      
      const result = await promise;
      jest.useRealTimers();
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    test('全てのリトライが失敗した場合は最後のエラーをスロー', async () => {
      const lastError = new Error('Final error');
      const operation = jest.fn().mockRejectedValue(lastError);
      
      await expect(ErrorHandler.retryOperation(operation, 2, 10)).rejects.toThrow(lastError);
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('safeExecute', () => {
    test('同期関数の実行に成功した場合は結果を返す', () => {
      const fn = jest.fn().mockReturnValue('result');
      
      const result = ErrorHandler.safeExecute(fn, 'default', 'test');
      
      expect(result).toBe('result');
    });

    test('同期関数でエラーが発生した場合はフォールバック値を返す', () => {
      const fn = jest.fn().mockImplementation(() => {
        throw new Error('Sync error');
      });
      
      const result = ErrorHandler.safeExecute(fn, 'fallback', 'test');
      
      expect(result).toBe('fallback');
    });

    test('非同期関数の実行に成功した場合は結果を返す', async () => {
      const fn = jest.fn().mockResolvedValue('async result');
      
      const result = await ErrorHandler.safeExecute(fn, 'fallback', 'test');
      
      expect(result).toBe('async result');
    });

    test('非同期関数でエラーが発生した場合はフォールバック値を返す', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Async error'));
      
      const result = await ErrorHandler.safeExecute(fn, 'fallback', 'test');
      
      expect(result).toBe('fallback');
    });
  });
});
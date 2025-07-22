/**
 * CalendarService の単体テスト
 */

// モジュールを読み込む前にグローバルを設定
global.ErrorHandler = {
  wrapChromeApi: jest.fn((fn) => fn()),
  logError: jest.fn(),
  retryOperation: jest.fn((fn) => fn())
};

global.CalendarGroupError = class CalendarGroupError extends Error {
  constructor(type, subType = 'default', details = {}) {
    super(`${type}: ${subType}`);
    this.type = type;
    this.subType = subType;
    this.details = details;
  }
};

global.ErrorTypes = {
  TAB_NOT_FOUND: 'TAB_NOT_FOUND',
  CHROME_API_ERROR: 'CHROME_API_ERROR'
};

// テスト対象を読み込む
const fs = require('fs');
const path = require('path');
const calendarServiceCode = fs.readFileSync(
  path.join(__dirname, '../../calendarService.js'),
  'utf8'
);

// グローバルスコープで実行
eval(calendarServiceCode);

describe('CalendarService', () => {
  let service;

  beforeEach(() => {
    service = new CalendarService();
  });

  describe('getActiveTab', () => {
    test('アクティブなGoogleカレンダータブを正常に取得', async () => {
      const mockTab = {
        id: 1,
        url: 'https://calendar.google.com/calendar',
        title: 'Google Calendar',
        status: 'complete'
      };
      TestUtils.setTabsResponse([mockTab]);
      
      const tab = await service.getActiveTab();
      
      expect(tab).toEqual(mockTab);
      expect(service.tabs).toEqual([mockTab]);
    });

    test('タブが見つからない場合はエラー', async () => {
      TestUtils.setTabsResponse([]);
      
      await expect(service.getActiveTab()).rejects.toThrow('TAB_NOT_FOUND');
    });

    test('Googleカレンダー以外のタブの場合はエラー', async () => {
      const mockTab = {
        id: 1,
        url: 'https://example.com',
        title: 'Example',
        status: 'complete'
      };
      TestUtils.setTabsResponse([mockTab]);
      
      await expect(service.getActiveTab()).rejects.toThrow('TAB_NOT_FOUND');
    });
  });

  describe('loadCalendars', () => {
    test('カレンダーリストを正常に読み込む', async () => {
      const mockTab = {
        id: 1,
        url: 'https://calendar.google.com',
        status: 'complete'
      };
      const mockCalendars = ['カレンダー1', 'カレンダー2', 'カレンダー3'];
      
      TestUtils.setTabsResponse([mockTab]);
      TestUtils.setMessageResponse({
        success: true,
        calendars: mockCalendars
      });
      
      const calendars = await service.loadCalendars();
      
      expect(calendars).toEqual(mockCalendars);
      expect(service.allCalendars).toEqual(mockCalendars);
    });

    test('タブが読み込み中の場合は待機する', async () => {
      const mockTab = {
        id: 1,
        url: 'https://calendar.google.com',
        status: 'loading'
      };
      
      TestUtils.setTabsResponse([mockTab]);
      TestUtils.setMessageResponse({
        success: true,
        calendars: ['カレンダー1']
      });
      
      // setTimeoutのモック
      jest.useFakeTimers();
      const promise = service.loadCalendars();
      jest.advanceTimersByTime(100);
      const calendars = await promise;
      jest.useRealTimers();
      
      expect(calendars).toEqual(['カレンダー1']);
    });

    test('エラーが発生しても空配列を返す（致命的でない）', async () => {
      TestUtils.setTabsResponse([]);
      
      const calendars = await service.loadCalendars();
      
      expect(calendars).toEqual([]);
      expect(service.allCalendars).toEqual([]);
      expect(ErrorHandler.logError).toHaveBeenCalled();
    });
  });

  describe('applyGroup', () => {
    beforeEach(() => {
      const mockTab = {
        id: 1,
        url: 'https://calendar.google.com',
        status: 'complete'
      };
      TestUtils.setTabsResponse([mockTab]);
    });

    test('グループを正常に適用', async () => {
      const members = ['メンバー1', 'メンバー2'];
      TestUtils.setMessageResponse({ success: true });
      ErrorHandler.retryOperation.mockImplementation((fn) => fn());
      
      const response = await service.applyGroup(members);
      
      expect(response).toEqual({ success: true });
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
        action: 'applyGroup',
        members: members
      });
    });

    test('適用に失敗した場合はエラー', async () => {
      const members = ['メンバー1'];
      TestUtils.setMessageResponse({ success: false });
      ErrorHandler.retryOperation.mockImplementation(async (fn) => {
        try {
          return await fn();
        } catch (e) {
          throw e;
        }
      });
      
      await expect(service.applyGroup(members)).rejects.toThrow('グループの適用に失敗しました');
    });
  });

  describe('showMyCalendarOnly', () => {
    test('自分のカレンダーのみ表示を正常に実行', async () => {
      const mockTab = {
        id: 1,
        url: 'https://calendar.google.com',
        status: 'complete'
      };
      TestUtils.setTabsResponse([mockTab]);
      TestUtils.setMessageResponse({ success: true });
      ErrorHandler.retryOperation.mockImplementation((fn) => fn());
      
      const response = await service.showMyCalendarOnly();
      
      expect(response).toEqual({ success: true });
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
        action: 'showMyCalendarOnly'
      });
    });
  });

  describe('getCalendarSuggestions', () => {
    beforeEach(() => {
      service.allCalendars = [
        '山田太郎',
        '山田花子',
        '田中一郎',
        '佐藤次郎',
        '鈴木三郎'
      ];
    });

    test('部分一致でカレンダー候補を取得', () => {
      const suggestions = service.getCalendarSuggestions('山田');
      
      expect(suggestions).toEqual(['山田太郎', '山田花子']);
    });

    test('完全一致を優先', () => {
      service.allCalendars.push('田中');
      const suggestions = service.getCalendarSuggestions('田中');
      
      expect(suggestions[0]).toBe('田中'); // 完全一致が最初
      expect(suggestions).toContain('田中一郎');
    });

    test('大文字小文字を無視して検索', () => {
      service.allCalendars = ['John Smith', 'Jane Doe'];
      const suggestions = service.getCalendarSuggestions('john');
      
      expect(suggestions).toEqual(['John Smith']);
    });

    test('最大5件まで返す', () => {
      service.allCalendars = Array(10).fill(0).map((_, i) => `カレンダー${i}`);
      const suggestions = service.getCalendarSuggestions('カレンダー');
      
      expect(suggestions).toHaveLength(5);
    });

    test('クエリが空の場合は空配列を返す', () => {
      expect(service.getCalendarSuggestions('')).toEqual([]);
      expect(service.getCalendarSuggestions(null)).toEqual([]);
    });
  });

  describe('getDebugInfo', () => {
    test('デバッグ情報を正常に取得', async () => {
      const mockTab = {
        id: 1,
        url: 'https://calendar.google.com',
        title: 'Google Calendar',
        status: 'complete'
      };
      const mockDomInfo = {
        checkboxCount: 10,
        samples: [
          { ariaLabel: 'カレンダー1', checked: true, disabled: false, id: 'cb1' }
        ],
        pageStructure: {
          hasMyCalendarsSection: true,
          hasOtherCalendarsSection: true
        }
      };
      
      TestUtils.setTabsResponse([mockTab]);
      chrome.scripting.executeScript.mockResolvedValue([{ result: mockDomInfo }]);
      service.allCalendars = ['カレンダー1', 'カレンダー2'];
      
      const debugInfo = await service.getDebugInfo();
      
      expect(debugInfo).toEqual({
        tabInfo: {
          url: mockTab.url,
          title: mockTab.title,
          status: mockTab.status
        },
        domInfo: mockDomInfo,
        calendars: ['カレンダー1', 'カレンダー2']
      });
    });
  });
});
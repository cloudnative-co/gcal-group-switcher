/**
 * カレンダーサービスモジュール
 * Googleカレンダーとの通信、カレンダーリストの管理を提供
 */

class CalendarService {
  constructor() {
    this.allCalendars = [];
    this.tabs = null;
  }

  /**
   * アクティブなタブの取得
   */
  async getActiveTab() {
    try {
      const tabs = await ErrorHandler.wrapChromeApi(
        () => chrome.tabs.query({active: true, currentWindow: true}),
        'tabs'
      );
      
      if (!tabs || tabs.length === 0) {
        throw new CalendarGroupError(ErrorTypes.TAB_NOT_FOUND);
      }
      
      const tab = tabs[0];
      if (!tab.url || !tab.url.includes('calendar.google.com')) {
        throw new CalendarGroupError(
          ErrorTypes.TAB_NOT_FOUND,
          'default'
        );
      }
      
      this.tabs = tabs;
      return tab;
    } catch (error) {
      ErrorHandler.logError(error);
      throw error;
    }
  }

  /**
   * カレンダーリストの読み込み
   */
  async loadCalendars() {
    try {
      const tab = await this.getActiveTab();
      
      // タブがまだ読み込み中の場合は少し待つ
      if (tab.status !== 'complete') {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      try {
        const response = await chrome.tabs.sendMessage(tab.id, {action: 'getCalendars'});
        if (response && response.calendars) {
          this.allCalendars = response.calendars;
        } else {
          this.allCalendars = [];
        }
      } catch (messageError) {
        // コンテンツスクリプトが未ロードの可能性
        ErrorHandler.logError(new CalendarGroupError(
          ErrorTypes.CHROME_API_ERROR,
          'runtime',
          { error: messageError.message }
        ));
        this.allCalendars = [];
      }
      
      return this.allCalendars;
    } catch (error) {
      ErrorHandler.logError(error);
      this.allCalendars = [];
      // カレンダーリストの読み込みエラーは致命的ではないため、エラーを再スローしない
      return [];
    }
  }

  /**
   * グループをカレンダーに適用
   */
  async applyGroup(members) {
    try {
      const tab = await this.getActiveTab();
      
      // グループ適用のリクエストを送信
      const response = await ErrorHandler.retryOperation(
        async () => {
          const res = await chrome.tabs.sendMessage(tab.id, {
            action: 'applyGroup',
            members: members
          });
          if (!res || !res.success) {
            throw new Error('グループの適用に失敗しました');
          }
          return res;
        },
        2, // 最大2回リトライ
        500 // 500msの遅延
      );
      
      return response;
    } catch (error) {
      ErrorHandler.logError(error);
      throw error;
    }
  }

  /**
   * 自分のカレンダーのみを表示
   */
  async showMyCalendarOnly() {
    try {
      const tab = await this.getActiveTab();
      
      const response = await ErrorHandler.retryOperation(
        async () => {
          const res = await chrome.tabs.sendMessage(tab.id, {
            action: 'showMyCalendarOnly'
          });
          if (!res || !res.success) {
            throw new Error('自分のカレンダーのみの表示に失敗しました');
          }
          return res;
        },
        2,
        500
      );
      
      return response;
    } catch (error) {
      ErrorHandler.logError(error);
      throw error;
    }
  }

  /**
   * カレンダーリストを取得
   */
  getCalendarList() {
    return [...this.allCalendars];
  }

  /**
   * オートコンプリート用のカレンダー候補を取得
   */
  getCalendarSuggestions(query) {
    if (!query || this.allCalendars.length === 0) {
      return [];
    }
    
    const lowerQuery = query.toLowerCase();
    return this.allCalendars
      .filter(calendar => calendar.toLowerCase().includes(lowerQuery))
      .sort((a, b) => {
        // 完全一致を優先
        const aExact = a.toLowerCase() === lowerQuery;
        const bExact = b.toLowerCase() === lowerQuery;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        
        // 先頭一致を次に優先
        const aStarts = a.toLowerCase().startsWith(lowerQuery);
        const bStarts = b.toLowerCase().startsWith(lowerQuery);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        
        // それ以外はアルファベット順
        return a.localeCompare(b);
      })
      .slice(0, 5); // 最大5件まで表示
  }

  /**
   * デバッグ情報の取得
   */
  async getDebugInfo() {
    try {
      const tab = await this.getActiveTab();
      
      // DOM構造を確認
      const [domInfo] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => {
          const checkboxes = document.querySelectorAll('input[type="checkbox"][aria-label]');
          const info = {
            checkboxCount: checkboxes.length,
            samples: [],
            pageStructure: {
              hasMyCalendarsSection: !!document.querySelector('[role="heading"][aria-label*="マイカレンダー"], [role="heading"][aria-label*="My calendars"]'),
              hasOtherCalendarsSection: !!document.querySelector('[role="heading"][aria-label*="他のカレンダー"], [role="heading"][aria-label*="Other calendars"]')
            }
          };
          
          checkboxes.forEach((cb, index) => {
            if (index < 5) {
              info.samples.push({
                ariaLabel: cb.getAttribute('aria-label'),
                checked: cb.checked,
                disabled: cb.disabled,
                id: cb.id || 'なし'
              });
            }
          });
          
          return info;
        }
      });
      
      return {
        tabInfo: {
          url: tab.url,
          title: tab.title,
          status: tab.status
        },
        domInfo: domInfo.result,
        calendars: this.allCalendars
      };
    } catch (error) {
      ErrorHandler.logError(error);
      throw error;
    }
  }
}

// シングルトンインスタンスを作成
const calendarService = new CalendarService();

// Chrome拡張機能での使用のため
if (typeof window !== 'undefined') {
  window.CalendarService = CalendarService;
  window.calendarService = calendarService;
}
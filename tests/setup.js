/**
 * Jest test setup file
 * Chrome API モックとグローバル設定
 */

// Chrome API のモック
global.chrome = {
  runtime: {
    onMessage: {
      addListener: jest.fn()
    },
    onInstalled: {
      addListener: jest.fn()
    },
    onConnect: {
      addListener: jest.fn()
    },
    sendMessage: jest.fn(),
    lastError: null,
    getManifest: jest.fn(() => ({
      version: '1.1.0',
      name: 'Google Calendar Group Switcher'
    }))
  },
  storage: {
    local: {
      get: jest.fn((keys, callback) => {
        if (callback) {
          callback({});
        }
        return Promise.resolve({});
      }),
      set: jest.fn((items, callback) => {
        if (callback) {
          callback();
        }
        return Promise.resolve();
      }),
      remove: jest.fn((keys, callback) => {
        if (callback) {
          callback();
        }
        return Promise.resolve();
      }),
      clear: jest.fn((callback) => {
        if (callback) {
          callback();
        }
        return Promise.resolve();
      })
    }
  },
  tabs: {
    query: jest.fn(() => Promise.resolve([])),
    sendMessage: jest.fn(() => Promise.resolve({})),
    onUpdated: {
      addListener: jest.fn()
    }
  },
  action: {
    onClicked: {
      addListener: jest.fn()
    }
  },
  scripting: {
    executeScript: jest.fn(() => Promise.resolve([{ result: {} }]))
  }
};

// localStorage のモック
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
global.localStorage = localStorageMock;

// DOM 要素のモック
global.document = {
  ...global.document,
  getElementById: jest.fn(() => ({
    innerHTML: '',
    value: '',
    style: {},
    addEventListener: jest.fn(),
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      contains: jest.fn()
    }
  })),
  querySelector: jest.fn(() => null),
  querySelectorAll: jest.fn(() => []),
  createElement: jest.fn(() => ({
    innerHTML: '',
    textContent: '',
    style: {},
    classList: {
      add: jest.fn(),
      remove: jest.fn()
    },
    appendChild: jest.fn(),
    addEventListener: jest.fn()
  }))
};

// navigator.clipboard のモック
global.navigator = {
  ...global.navigator,
  clipboard: {
    writeText: jest.fn(() => Promise.resolve()),
    readText: jest.fn(() => Promise.resolve(''))
  }
};

// カスタムイベントのモック
global.CustomEvent = class CustomEvent extends Event {
  constructor(type, params) {
    super(type, params);
    this.detail = params?.detail;
  }
};

// テストユーティリティ
global.TestUtils = {
  // Chrome storage のモックデータを設定
  setStorageData: (data) => {
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      const result = {};
      if (Array.isArray(keys)) {
        keys.forEach(key => {
          if (data[key] !== undefined) {
            result[key] = data[key];
          }
        });
      } else if (typeof keys === 'string') {
        if (data[keys] !== undefined) {
          result[keys] = data[keys];
        }
      } else if (keys === null || keys === undefined) {
        Object.assign(result, data);
      }
      
      if (callback) {
        callback(result);
      }
      return Promise.resolve(result);
    });
  },
  
  // DOM 要素のモックを作成
  createMockElement: (id, properties = {}) => {
    const element = {
      id,
      innerHTML: '',
      value: '',
      style: {},
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        contains: jest.fn(),
        toggle: jest.fn()
      },
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      appendChild: jest.fn(),
      removeChild: jest.fn(),
      querySelector: jest.fn(),
      querySelectorAll: jest.fn(() => []),
      setAttribute: jest.fn(),
      getAttribute: jest.fn(),
      ...properties
    };
    
    document.getElementById.mockImplementation((elementId) => {
      return elementId === id ? element : null;
    });
    
    return element;
  },
  
  // Chrome tabs API のモックレスポンスを設定
  setTabsResponse: (tabs) => {
    chrome.tabs.query.mockResolvedValue(tabs);
  },
  
  // Chrome tabs.sendMessage のモックレスポンスを設定
  setMessageResponse: (response) => {
    chrome.tabs.sendMessage.mockResolvedValue(response);
  }
};

// テスト後のクリーンアップ
afterEach(() => {
  jest.clearAllMocks();
});
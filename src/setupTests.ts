// Jest setup file
import '@testing-library/jest-dom';

// Mock Chrome APIs
Object.assign(global, {
  chrome: {
    runtime: {
      sendMessage: jest.fn(),
      onMessage: {
        addListener: jest.fn()
      },
      onInstalled: {
        addListener: jest.fn()
      }
    },
    tabs: {
      query: jest.fn(),
      sendMessage: jest.fn()
    },
    contextMenus: {
      create: jest.fn(),
      onClicked: {
        addListener: jest.fn()
      }
    },
    sidePanel: {
      setPanelBehavior: jest.fn(),
      open: jest.fn()
    },
    commands: {
      onCommand: {
        addListener: jest.fn()
      }
    },
    storage: {
      local: {
        get: jest.fn(),
        set: jest.fn()
      }
    }
  }
});

// Mock IndexedDB
const mockIndexedDB = {
  open: jest.fn(() => ({
    result: {
      createObjectStore: jest.fn(),
      transaction: jest.fn(() => ({
        objectStore: jest.fn(() => ({
          put: jest.fn(),
          get: jest.fn(),
          getAll: jest.fn(),
          delete: jest.fn(),
          clear: jest.fn()
        }))
      }))
    },
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null
  }))
};

Object.defineProperty(global, 'indexedDB', {
  value: mockIndexedDB,
  writable: true
});

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: jest.fn(() => 'mock-uuid-123')
  },
  writable: true
});

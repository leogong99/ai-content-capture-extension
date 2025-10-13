import { storageService } from '../storage';
import { createMockContentEntry } from '@/utils/test-helpers';

// Mock IndexedDB
const mockDB = {
  transaction: jest.fn(() => ({
    objectStore: jest.fn(() => ({
      put: jest.fn(),
      get: jest.fn(),
      getAll: jest.fn(),
      delete: jest.fn()
    }))
  }))
};

jest.mock('indexedDB', () => ({
  open: jest.fn(() => ({
    result: mockDB,
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null
  }))
}));

describe('StorageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should initialize storage service', async () => {
    await expect(storageService.init()).resolves.not.toThrow();
  });

  test('should save entry', async () => {
    const mockEntry = createMockContentEntry();
    await storageService.init();
    
    await expect(storageService.saveEntry(mockEntry)).resolves.not.toThrow();
  });

  test('should get entry by id', async () => {
    const mockEntry = createMockContentEntry();
    mockDB.transaction().objectStore().get.mockImplementation((_id, callback) => {
      callback({ result: mockEntry });
    });
    
    await storageService.init();
    const result = await storageService.getEntry('test-id');
    
    expect(result).toEqual(mockEntry);
  });

  test('should get all entries', async () => {
    const mockEntries = [createMockContentEntry(), createMockContentEntry()];
    mockDB.transaction().objectStore().getAll.mockImplementation((callback) => {
      callback({ result: mockEntries });
    });
    
    await storageService.init();
    const result = await storageService.getAllEntries();
    
    expect(result).toEqual(mockEntries);
  });
});

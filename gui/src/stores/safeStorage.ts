import { createJSONStorage, type PersistStorage } from 'zustand/middleware';

function createFallbackStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: (name: string) => store[name] ?? null,
    setItem: (name: string, value: string) => { store[name] = value; },
    removeItem: (name: string) => { delete store[name]; },
  };
}

export function createSafeStorage<T = unknown>(storeName: string): PersistStorage<T> {
  try {
    const testKey = '__zustand_storage_test__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return createJSONStorage(() => localStorage) as PersistStorage<T>;
  } catch {
    console.warn(`[${storeName}] localStorage unavailable, using in-memory fallback`);
    return createJSONStorage(() => createFallbackStorage()) as PersistStorage<T>;
  }
}

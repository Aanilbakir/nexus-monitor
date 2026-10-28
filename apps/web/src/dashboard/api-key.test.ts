import { describe, expect, it } from 'vitest';

import {
  clearApiKey,
  DASHBOARD_API_KEY_STORAGE_KEY,
  loadApiKey,
  saveApiKey,
} from './api-key';

function createStorage(): Storage {
  return window.sessionStorage;
}

describe('dashboard api key storage', () => {
  it('returns null when no key has been stored', () => {
    const storage = createStorage();
    storage.clear();

    expect(loadApiKey(storage)).toBeNull();
  });

  it('round-trips a saved key through the provided storage', () => {
    const storage = createStorage();
    storage.clear();

    saveApiKey('a-dashboard-api-key', storage);

    expect(loadApiKey(storage)).toBe('a-dashboard-api-key');
    expect(storage.getItem(DASHBOARD_API_KEY_STORAGE_KEY)).toBe(
      'a-dashboard-api-key',
    );
  });

  it('never writes the key to localStorage', () => {
    window.localStorage.clear();
    const storage = createStorage();
    storage.clear();

    saveApiKey('a-dashboard-api-key', storage);

    expect(
      window.localStorage.getItem(DASHBOARD_API_KEY_STORAGE_KEY),
    ).toBeNull();
  });

  it('removes a stored key on clear', () => {
    const storage = createStorage();
    saveApiKey('a-dashboard-api-key', storage);

    clearApiKey(storage);

    expect(loadApiKey(storage)).toBeNull();
  });

  it('defaults to window.sessionStorage when no storage is given', () => {
    window.sessionStorage.clear();
    saveApiKey('default-storage-key');

    expect(loadApiKey()).toBe('default-storage-key');
    window.sessionStorage.clear();
  });
});

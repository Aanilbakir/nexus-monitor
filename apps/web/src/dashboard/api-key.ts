export const DASHBOARD_API_KEY_STORAGE_KEY = 'nexus-monitor.dashboard-api-key';

export function loadApiKey(
  storage: Storage = window.sessionStorage,
): string | null {
  return storage.getItem(DASHBOARD_API_KEY_STORAGE_KEY);
}

export function saveApiKey(
  key: string,
  storage: Storage = window.sessionStorage,
): void {
  storage.setItem(DASHBOARD_API_KEY_STORAGE_KEY, key);
}

export function clearApiKey(storage: Storage = window.sessionStorage): void {
  storage.removeItem(DASHBOARD_API_KEY_STORAGE_KEY);
}

export type Language = 'en' | 'tr';

export const LANGUAGE_STORAGE_KEY = 'nexus-monitor.language';

export function detectLanguage(
  languages: readonly string[] = navigator.languages,
): Language {
  return languages.some((language) => language.toLowerCase().startsWith('tr'))
    ? 'tr'
    : 'en';
}

export function loadLanguage(
  storage: Storage = localStorage,
  languages?: readonly string[],
): Language {
  const stored = storage.getItem(LANGUAGE_STORAGE_KEY);
  return stored === 'en' || stored === 'tr'
    ? stored
    : detectLanguage(languages);
}

export function saveLanguage(
  language: Language,
  storage: Storage = localStorage,
): void {
  storage.setItem(LANGUAGE_STORAGE_KEY, language);
}


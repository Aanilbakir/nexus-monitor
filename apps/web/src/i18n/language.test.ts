import { describe, expect, it } from 'vitest';

import {
  detectLanguage,
  LANGUAGE_STORAGE_KEY,
  loadLanguage,
  saveLanguage,
} from './language';

describe('dashboard language', () => {
  it('detects Turkish locales and otherwise defaults to English', () => {
    expect(detectLanguage(['tr-TR', 'en-US'])).toBe('tr');
    expect(detectLanguage(['de-DE'])).toBe('en');
  });

  it('loads a valid global preference and ignores invalid storage', () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'tr');
    expect(loadLanguage(localStorage, ['en-US'])).toBe('tr');
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'invalid');
    expect(loadLanguage(localStorage, ['en-US'])).toBe('en');
  });

  it('persists the selected global preference', () => {
    saveLanguage('tr', localStorage);
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('tr');
  });
});


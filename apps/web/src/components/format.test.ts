import { describe, expect, it } from 'vitest';

import { messages } from '../i18n/messages';
import { formatBytes, formatDuration, formatPercent } from './format';

describe('dashboard formatters', () => {
  it('formats byte counters with stable binary units', () => {
    expect(formatBytes('1073741824', 'en')).toBe('1 GB');
    expect(formatBytes('1536', 'en')).toBe('1.5 KB');
  });

  it('formats durations without implying false precision', () => {
    expect(formatDuration('90061', messages.en)).toBe('1d 1h 1m');
    expect(formatDuration('3600', messages.tr)).toBe('1sa 0dk');
  });

  it('formats percentages to at most one decimal place', () => {
    expect(formatPercent(24.56)).toBe('24.6%');
    expect(formatPercent(50)).toBe('50%');
  });
});

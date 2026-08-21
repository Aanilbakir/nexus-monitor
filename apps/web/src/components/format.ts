import type { Language } from '../i18n/language';
import type { Messages } from '../i18n/messages';

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'] as const;

export function formatBytes(value: string, language: Language): string {
  let amount = Number(value);
  let unit = 0;
  while (amount >= 1024 && unit < BYTE_UNITS.length - 1) {
    amount /= 1024;
    unit += 1;
  }

  return `${new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(amount)} ${BYTE_UNITS[unit]}`;
}

export function formatDuration(seconds: string, copy: Messages): string {
  const totalMinutes = Math.floor(Number(seconds) / 60);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}${copy.dayShort} ${hours}${copy.hourShort} ${minutes}${copy.minuteShort}`;
  }

  return `${hours}${copy.hourShort} ${minutes}${copy.minuteShort}`;
}

export function formatPercent(value: number): string {
  return `${new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(value)}%`;
}

export function formatTimestamp(
  value: string | null,
  language: Language,
  unavailable: string,
): string {
  return value
    ? new Intl.DateTimeFormat(language, {
        dateStyle: 'medium',
        timeStyle: 'medium',
      }).format(new Date(value))
    : unavailable;
}

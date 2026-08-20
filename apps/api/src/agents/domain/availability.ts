import {
  OFFLINE_THRESHOLD_SECONDS,
  type HostAvailability,
} from '@nexus-monitor/contracts';

export function getHostAvailability(
  lastSeenAt: Date | null,
  now: Date,
): HostAvailability {
  if (!lastSeenAt) {
    return 'offline';
  }

  const ageMilliseconds = now.getTime() - lastSeenAt.getTime();
  return ageMilliseconds <= OFFLINE_THRESHOLD_SECONDS * 1_000
    ? 'online'
    : 'offline';
}

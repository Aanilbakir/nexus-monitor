const HOST_ROUTE =
  /^\/hosts\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/?$/i;

export interface HistoryWriter {
  pushState(data: unknown, unused: string, url?: string | URL | null): void;
}

export function readHostRoute(pathname: string): string | null {
  return HOST_ROUTE.exec(pathname)?.[1]?.toLowerCase() ?? null;
}

export function navigateToHost(
  hostId: string,
  historyWriter: HistoryWriter = window.history,
): void {
  historyWriter.pushState(null, '', `/hosts/${encodeURIComponent(hostId)}`);
}

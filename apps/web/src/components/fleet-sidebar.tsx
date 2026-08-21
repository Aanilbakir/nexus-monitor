import type { DashboardHost } from '@nexus-monitor/contracts';
import { useMemo, useState } from 'react';
import type { Messages } from '../i18n/messages';

export function FleetSidebar({
  copy,
  hosts,
  onSelect,
  selectedHostId,
}: {
  readonly copy: Messages;
  readonly hosts: readonly DashboardHost[];
  readonly onSelect: (hostId: string) => void;
  readonly selectedHostId: string | null;
}) {
  const [query, setQuery] = useState('');
  const visibleHosts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return normalized
      ? hosts.filter((host) =>
          host.hostname.toLocaleLowerCase().includes(normalized),
        )
      : hosts;
  }, [hosts, query]);
  const online = hosts.filter((host) => host.availability === 'online').length;

  return (
    <aside className="fleet-sidebar" aria-label={copy.fleet}>
      <div className="fleet-summary">
        <div>
          <span>{copy.total}</span>
          <strong>{String(hosts.length).padStart(2, '0')}</strong>
        </div>
        <div>
          <span>{copy.online}</span>
          <strong>{String(online).padStart(2, '0')}</strong>
        </div>
        <div>
          <span>{copy.offline}</span>
          <strong>{String(hosts.length - online).padStart(2, '0')}</strong>
        </div>
      </div>
      <label className="search-field">
        <span>{copy.searchHosts}</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="hostname"
        />
      </label>
      <nav className="host-list" aria-label={copy.allHosts}>
        {visibleHosts.map((host) => (
          <button
            aria-current={host.id === selectedHostId ? 'page' : undefined}
            className="host-row"
            key={host.id}
            onClick={() => onSelect(host.id)}
            type="button"
          >
            <span
              className={`status-mark status-${host.availability}`}
              aria-hidden="true"
            />
            <span className="host-row-name">{host.hostname}</span>
            <span className="host-row-state">
              {host.availability === 'online' ? copy.online : copy.offline}
            </span>
          </button>
        ))}
      </nav>
    </aside>
  );
}

import { useState } from 'react';

import { ApiKeyGate } from './components/api-key-gate';
import { AppShell } from './components/app-shell';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from './components/dashboard-states';
import { HostDetail } from './components/host-detail';
import { useDashboard } from './dashboard/use-dashboard';
import { loadLanguage, saveLanguage, type Language } from './i18n/language';
import { messages } from './i18n/messages';

export function App() {
  const dashboard = useDashboard();
  const [language, setLanguage] = useState<Language>(() => loadLanguage());
  const copy = messages[language];

  const changeLanguage = (nextLanguage: Language): void => {
    saveLanguage(nextLanguage);
    setLanguage(nextLanguage);
  };

  if (dashboard.loadState === 'unauthorized') {
    return <ApiKeyGate copy={copy} onSubmit={dashboard.retry} />;
  }

  if (dashboard.loadState === 'loading') {
    return <LoadingState copy={copy} />;
  }

  if (dashboard.loadState === 'error') {
    return <ErrorState copy={copy} retry={dashboard.retry} />;
  }

  return (
    <AppShell
      connection={dashboard.connection}
      copy={copy}
      hosts={dashboard.hosts}
      language={language}
      onLanguageChange={changeLanguage}
      onSelectHost={dashboard.selectHost}
      selectedHostId={dashboard.selectedHostId}
    >
      {dashboard.hosts.length === 0 ? (
        <EmptyState copy={copy} />
      ) : dashboard.selectedHost ? (
        <HostDetail
          copy={copy}
          host={dashboard.selectedHost}
          language={language}
        />
      ) : (
        <div className="state-view">
          <h1>{copy.selectHost}</h1>
        </div>
      )}
    </AppShell>
  );
}

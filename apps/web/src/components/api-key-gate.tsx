import { useState, type FormEvent } from 'react';

import { saveApiKey } from '../dashboard/api-key';
import type { Messages } from '../i18n/messages';

export interface ApiKeyGateProps {
  readonly copy: Messages;
  readonly onSubmit: (key: string) => void;
}

export function ApiKeyGate({ copy, onSubmit }: ApiKeyGateProps) {
  const [value, setValue] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    saveApiKey(trimmed);
    onSubmit(trimmed);
  };

  return (
    <div className="state-view">
      <h1>{copy.apiKeyTitle}</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="dashboard-api-key">{copy.apiKeyLabel}</label>
        <input
          id="dashboard-api-key"
          onChange={(event) => setValue(event.target.value)}
          type="password"
          value={value}
        />
        <button className="action-button" type="submit">
          {copy.apiKeySubmit}
        </button>
      </form>
    </div>
  );
}

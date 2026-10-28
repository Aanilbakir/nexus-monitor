import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DASHBOARD_API_KEY_STORAGE_KEY } from '../dashboard/api-key';
import { messages } from '../i18n/messages';
import { ApiKeyGate } from './api-key-gate';

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe('ApiKeyGate', () => {
  it('stores the submitted key in sessionStorage only and notifies the caller', () => {
    const onSubmit = vi.fn();
    render(<ApiKeyGate copy={messages.en} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(messages.en.apiKeyLabel), {
      target: { value: 'my-dashboard-key' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: messages.en.apiKeySubmit }),
    );

    expect(window.sessionStorage.getItem(DASHBOARD_API_KEY_STORAGE_KEY)).toBe(
      'my-dashboard-key',
    );
    expect(
      window.localStorage.getItem(DASHBOARD_API_KEY_STORAGE_KEY),
    ).toBeNull();
    expect(onSubmit).toHaveBeenCalledWith('my-dashboard-key');
  });

  it('does not submit or store a blank key', () => {
    const onSubmit = vi.fn();
    render(<ApiKeyGate copy={messages.en} onSubmit={onSubmit} />);

    fireEvent.click(
      screen.getByRole('button', { name: messages.en.apiKeySubmit }),
    );

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      window.sessionStorage.getItem(DASHBOARD_API_KEY_STORAGE_KEY),
    ).toBeNull();
  });

  it('trims surrounding whitespace before storing and submitting the key', () => {
    const onSubmit = vi.fn();
    render(<ApiKeyGate copy={messages.en} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(messages.en.apiKeyLabel), {
      target: { value: '  my-dashboard-key  ' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: messages.en.apiKeySubmit }),
    );

    expect(onSubmit).toHaveBeenCalledWith('my-dashboard-key');
    expect(window.sessionStorage.getItem(DASHBOARD_API_KEY_STORAGE_KEY)).toBe(
      'my-dashboard-key',
    );
  });
});

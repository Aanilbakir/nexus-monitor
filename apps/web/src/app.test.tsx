import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './app';

describe('App', () => {
  it('presents an honest monitoring platform foundation', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'NEXUS Monitor' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Foundation online')).toBeInTheDocument();
    expect(
      screen.getByText(
        'The monitoring workspace is ready for host registration and telemetry in the next phase.',
      ),
    ).toBeInTheDocument();
  });
});

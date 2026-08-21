import { describe, expect, it, vi } from 'vitest';

import { navigateToHost, readHostRoute } from './routing';

describe('dashboard routing', () => {
  it.each([
    ['/', null],
    ['/hosts/11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111'],
    ['/hosts/not-valid', null],
    ['/other', null],
  ])('reads %s', (pathname, expected) => {
    expect(readHostRoute(pathname)).toBe(expected);
  });

  it('writes a canonical encoded host route', () => {
    const pushState = vi.fn();
    navigateToHost('11111111-1111-4111-8111-111111111111', { pushState });
    expect(pushState).toHaveBeenCalledWith(
      null,
      '',
      '/hosts/11111111-1111-4111-8111-111111111111',
    );
  });
});


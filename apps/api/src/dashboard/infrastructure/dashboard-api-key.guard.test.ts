import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';

import { CredentialService } from '../../agents/domain/credential.service.js';
import { DashboardApiKeyGuard } from './dashboard-api-key.guard.js';

const DASHBOARD_API_KEY = 'a-dashboard-api-key-that-is-long-enough-32';

function createContext(authorization: string | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization } }),
    }),
  } as unknown as ExecutionContext;
}

describe('DashboardApiKeyGuard', () => {
  it('allows a request carrying the correct bearer key', () => {
    const guard = new DashboardApiKeyGuard(
      new CredentialService(DASHBOARD_API_KEY),
    );

    expect(
      guard.canActivate(createContext(`Bearer ${DASHBOARD_API_KEY}`)),
    ).toBe(true);
  });

  it('delegates the comparison to the constant-time credential primitive', () => {
    const credentials = new CredentialService(DASHBOARD_API_KEY);
    const verifySpy = jest.spyOn(credentials, 'verifyEnrollmentToken');
    const guard = new DashboardApiKeyGuard(credentials);

    guard.canActivate(createContext(`Bearer ${DASHBOARD_API_KEY}`));

    expect(verifySpy).toHaveBeenCalledWith(DASHBOARD_API_KEY);
  });

  it('rejects a request with no authorization header', () => {
    const guard = new DashboardApiKeyGuard(
      new CredentialService(DASHBOARD_API_KEY),
    );

    expect(() => guard.canActivate(createContext(undefined))).toThrow(
      UnauthorizedException,
    );
  });

  it('allows a request using a lowercase bearer scheme', () => {
    const guard = new DashboardApiKeyGuard(
      new CredentialService(DASHBOARD_API_KEY),
    );

    expect(
      guard.canActivate(createContext(`bearer ${DASHBOARD_API_KEY}`)),
    ).toBe(true);
  });

  it('allows a request using an uppercase BEARER scheme', () => {
    const guard = new DashboardApiKeyGuard(
      new CredentialService(DASHBOARD_API_KEY),
    );

    expect(
      guard.canActivate(createContext(`BEARER ${DASHBOARD_API_KEY}`)),
    ).toBe(true);
  });

  it('rejects a request using a non-bearer scheme', () => {
    const guard = new DashboardApiKeyGuard(
      new CredentialService(DASHBOARD_API_KEY),
    );

    expect(() =>
      guard.canActivate(createContext(`Basic ${DASHBOARD_API_KEY}`)),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a request with the wrong key', () => {
    const guard = new DashboardApiKeyGuard(
      new CredentialService(DASHBOARD_API_KEY),
    );

    expect(() =>
      guard.canActivate(
        createContext('Bearer the-wrong-key-padded-to-32-characters'),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a bearer value padded with extra whitespace', () => {
    const guard = new DashboardApiKeyGuard(
      new CredentialService(DASHBOARD_API_KEY),
    );

    expect(() =>
      guard.canActivate(createContext(`Bearer  ${DASHBOARD_API_KEY} `)),
    ).toThrow(UnauthorizedException);
  });

  it('never echoes the submitted key in the rejection message', () => {
    const guard = new DashboardApiKeyGuard(
      new CredentialService(DASHBOARD_API_KEY),
    );
    const wrongKey = 'the-wrong-secret-value-padded-to-32-chars';

    expect.assertions(2);
    try {
      guard.canActivate(createContext(`Bearer ${wrongKey}`));
    } catch (error) {
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).message).not.toContain(wrongKey);
    }
  });
});

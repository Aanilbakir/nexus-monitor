import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';

import { CredentialService } from '../../agents/domain/credential.service.js';

const BEARER_PATTERN = /^Bearer ([^\s]+)$/i;
const UNAUTHORIZED_MESSAGE = 'Dashboard authentication failed.';

interface RequestWithHeaders {
  headers: { authorization?: string };
}

@Injectable()
export class DashboardApiKeyGuard implements CanActivate {
  public constructor(private readonly credentials: CredentialService) {}

  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithHeaders>();
    const match = BEARER_PATTERN.exec(request.headers.authorization ?? '');
    const token = match?.[1];

    if (!token || !this.credentials.verifyEnrollmentToken(token)) {
      throw new UnauthorizedException(UNAUTHORIZED_MESSAGE);
    }

    return true;
  }
}

/**
 * `@UseGuards(SomeClass)` never consults a custom provider registered for
 * `SomeClass`'s own token: Nest's scanner treats a bare class reference in
 * guard/interceptor/pipe/filter metadata as something to auto-instantiate
 * through its "injectables" pipeline (`Module#addInjectable`), which is a
 * collection entirely separate from `Module#providers`. The guard that
 * actually executes at request time is looked up exclusively from that
 * `injectables` map (see `@nestjs/core`'s `GuardsContextCreator`), so a
 * `{ provide: DashboardApiKeyGuard, useFactory: ... }` provider declared
 * alongside it is never the instance that runs -- Nest instead tries to
 * build a brand new `DashboardApiKeyGuard` via plain constructor DI, which
 * fails because `CredentialService` is never registered as its own
 * provider token.
 *
 * Referencing this thin pass-through guard from `@UseGuards()` keeps that
 * auto-instantiation path working: its only constructor dependency is the
 * `DashboardApiKeyGuard` token itself, and *that* lookup is resolved the
 * normal way, against the hosting module's `providers` -- which is exactly
 * where the custom factory (production or test) registers it.
 */
@Injectable()
export class DashboardAuthGuard implements CanActivate {
  public constructor(
    @Inject(DashboardApiKeyGuard)
    private readonly guard: DashboardApiKeyGuard,
  ) {}

  public canActivate(context: ExecutionContext): boolean {
    return this.guard.canActivate(context);
  }
}

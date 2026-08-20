import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export type RandomBytes = (size: number) => Buffer;

export class CredentialService {
  public constructor(
    private readonly enrollmentToken: string,
    private readonly createRandomBytes: RandomBytes = randomBytes,
  ) {}

  public verifyEnrollmentToken(candidate: string): boolean {
    return this.safeCompare(candidate, this.enrollmentToken);
  }

  public createAgentToken(): string {
    return this.createRandomBytes(32).toString('base64url');
  }

  public hash(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }

  public verifyAgentToken(candidate: string, storedHash: string): boolean {
    return this.safeCompare(this.hash(candidate), storedHash);
  }

  private safeCompare(left: string, right: string): boolean {
    const leftDigest = createHash('sha256').update(left, 'utf8').digest();
    const rightDigest = createHash('sha256').update(right, 'utf8').digest();

    return timingSafeEqual(leftDigest, rightDigest);
  }
}

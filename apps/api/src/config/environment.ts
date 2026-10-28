export interface ApiEnvironment {
  readonly agentEnrollmentToken: string;
  readonly dashboardApiKey: string;
  readonly databaseUrl: string;
  readonly host: string;
  readonly nodeEnv: string;
  readonly port: number;
}

const DASHBOARD_API_KEY_MIN_LENGTH = 32;

export function readApiEnvironment(
  source: Readonly<Record<string, string | undefined>>,
): ApiEnvironment {
  const rawPort = source.API_PORT ?? '3000';
  const port = Number(rawPort);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(
      'Invalid API_PORT: expected an integer between 1 and 65535.',
    );
  }

  const agentEnrollmentToken = readRequired(source, 'AGENT_ENROLLMENT_TOKEN');
  const dashboardApiKey = readRequired(source, 'DASHBOARD_API_KEY');
  const databaseUrl = readRequired(source, 'DATABASE_URL');

  if (dashboardApiKey.length < DASHBOARD_API_KEY_MIN_LENGTH) {
    throw new Error(
      `Invalid DASHBOARD_API_KEY: expected at least ${DASHBOARD_API_KEY_MIN_LENGTH} characters.`,
    );
  }

  return {
    agentEnrollmentToken,
    dashboardApiKey,
    databaseUrl,
    host: source.API_HOST ?? '127.0.0.1',
    nodeEnv: source.NODE_ENV ?? 'development',
    port,
  };
}

function readRequired(
  source: Readonly<Record<string, string | undefined>>,
  key: string,
): string {
  const value = source[key]?.trim();

  if (!value) {
    throw new Error(`Invalid ${key}: expected a non-empty value.`);
  }

  return value;
}

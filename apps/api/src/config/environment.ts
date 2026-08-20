export interface ApiEnvironment {
  readonly host: string;
  readonly nodeEnv: string;
  readonly port: number;
}

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

  return {
    host: source.API_HOST ?? '127.0.0.1',
    nodeEnv: source.NODE_ENV ?? 'development',
    port,
  };
}

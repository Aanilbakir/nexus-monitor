import { AgentClient, type HttpTransport } from './agent-client.js';

describe('AgentClient', () => {
  const metadata = {
    architecture: 'x64',
    hostname: 'workstation',
    platform: 'win32',
  };

  it('registers with the enrollment token', async () => {
    const transport = jest
      .fn<ReturnType<HttpTransport>, Parameters<HttpTransport>>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            agentToken: 'agent-secret',
            heartbeatIntervalSeconds: 15,
            registeredAt: '2026-08-21T10:00:00.000Z',
          }),
          { status: 201 },
        ),
      );
    const client = new AgentClient('http://localhost:3000/', transport);

    await client.register(
      {
        agentId: '11111111-1111-4111-8111-111111111111',
        hostId: '22222222-2222-4222-8222-222222222222',
      },
      metadata,
      '0.1.0',
      'enrollment-secret',
    );

    expect(transport).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/agents/register',
      {
        body: JSON.stringify({
          agentId: '11111111-1111-4111-8111-111111111111',
          hostId: '22222222-2222-4222-8222-222222222222',
          ...metadata,
          agentVersion: '0.1.0',
        }),
        headers: {
          Authorization: 'Bearer enrollment-secret',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
    );
  });

  it('sends heartbeats with the agent token', async () => {
    const transport = jest
      .fn<ReturnType<HttpTransport>, Parameters<HttpTransport>>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            heartbeatIntervalSeconds: 15,
            receivedAt: '2026-08-21T10:00:00.000Z',
          }),
          { status: 200 },
        ),
      );
    const client = new AgentClient('http://localhost:3000/', transport);

    await client.heartbeat(
      '11111111-1111-4111-8111-111111111111',
      'agent-secret',
      metadata,
    );

    expect(transport).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/agents/11111111-1111-4111-8111-111111111111/heartbeat',
      {
        body: JSON.stringify(metadata),
        headers: {
          Authorization: 'Bearer agent-secret',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
    );
  });

  it('sends a system metric sample with the agent token', async () => {
    const transport = jest
      .fn<ReturnType<HttpTransport>, Parameters<HttpTransport>>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            collectedAt: '2026-08-21T09:59:59.000Z',
            metricsIntervalSeconds: 15,
            receivedAt: '2026-08-21T10:00:00.000Z',
          }),
          { status: 200 },
        ),
      );
    const client = new AgentClient('http://localhost:3000/', transport);
    const sample = {
      collectedAt: '2026-08-21T09:59:59.000Z',
      cpuPercent: 25,
      diskFreeBytes: 400,
      diskTotalBytes: 1_000,
      diskUsedBytes: 500,
      memoryTotalBytes: 1_000,
      memoryUsedBytes: 600,
      networkReceivedBytes: 2_000,
      networkTransmittedBytes: 1_500,
      uptimeSeconds: 3_600,
    };

    await client.sendMetrics(
      '11111111-1111-4111-8111-111111111111',
      'agent-secret',
      sample,
    );

    expect(transport).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/agents/11111111-1111-4111-8111-111111111111/metrics',
      {
        body: JSON.stringify(sample),
        headers: {
          Authorization: 'Bearer agent-secret',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
    );
  });
});

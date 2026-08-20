CREATE TABLE "Host" (
    "id" UUID NOT NULL,
    "hostname" VARCHAR(255) NOT NULL,
    "platform" VARCHAR(32) NOT NULL,
    "architecture" VARCHAR(32) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Host_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Agent" (
    "id" UUID NOT NULL,
    "hostId" UUID NOT NULL,
    "version" VARCHAR(32) NOT NULL,
    "credentialHash" CHAR(64) NOT NULL,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Heartbeat" (
    "id" BIGSERIAL NOT NULL,
    "agentId" UUID NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Heartbeat_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Agent_hostId_idx" ON "Agent"("hostId");
CREATE INDEX "Agent_lastSeenAt_idx" ON "Agent"("lastSeenAt");
CREATE INDEX "Heartbeat_agentId_receivedAt_idx" ON "Heartbeat"("agentId", "receivedAt" DESC);

ALTER TABLE "Agent"
ADD CONSTRAINT "Agent_hostId_fkey"
FOREIGN KEY ("hostId") REFERENCES "Host"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Heartbeat"
ADD CONSTRAINT "Heartbeat_agentId_fkey"
FOREIGN KEY ("agentId") REFERENCES "Agent"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AlertRule" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "metric" VARCHAR(32) NOT NULL,
    "comparison" VARCHAR(8) NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "severity" VARCHAR(16) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AlertRule_metric_check"
        CHECK ("metric" IN (
            'cpuPercent',
            'memoryTotalBytes',
            'memoryUsedBytes',
            'diskTotalBytes',
            'diskUsedBytes',
            'diskFreeBytes',
            'networkReceivedBytes',
            'networkTransmittedBytes',
            'uptimeSeconds'
        )),
    CONSTRAINT "AlertRule_comparison_check"
        CHECK ("comparison" IN ('>', '>=', '<', '<=')),
    CONSTRAINT "AlertRule_severity_check"
        CHECK ("severity" IN ('info', 'warning', 'critical')),
    CONSTRAINT "AlertRule_durationSeconds_check"
        CHECK ("durationSeconds" >= 0)
);

CREATE TABLE "AlertInstance" (
    "id" UUID NOT NULL,
    "ruleId" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "dedupeKey" VARCHAR(255) NOT NULL,
    "state" VARCHAR(16) NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "observedValue" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "AlertInstance_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AlertInstance_state_check"
        CHECK ("state" IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED')),
    CONSTRAINT "AlertInstance_state_timestamps_check"
        CHECK (
            ("state" = 'OPEN' AND "acknowledgedAt" IS NULL AND "resolvedAt" IS NULL) OR
            ("state" = 'ACKNOWLEDGED' AND "acknowledgedAt" IS NOT NULL AND "resolvedAt" IS NULL) OR
            ("state" = 'RESOLVED' AND "resolvedAt" IS NOT NULL)
        )
);

CREATE TABLE "AlertTransition" (
    "id" BIGSERIAL NOT NULL,
    "alertInstanceId" UUID NOT NULL,
    "fromState" VARCHAR(16),
    "toState" VARCHAR(16) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertTransition_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AlertTransition_fromState_check"
        CHECK ("fromState" IS NULL OR "fromState" IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED')),
    CONSTRAINT "AlertTransition_toState_check"
        CHECK ("toState" IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED'))
);

CREATE INDEX "AlertInstance_agentId_openedAt_idx" ON "AlertInstance"("agentId", "openedAt" DESC);
CREATE INDEX "AlertInstance_ruleId_idx" ON "AlertInstance"("ruleId");

-- Prisma DSL cannot express a filtered unique index: only one active (non-resolved)
-- instance per dedupe key may exist at a time, while resolved history can repeat it.
CREATE UNIQUE INDEX "AlertInstance_dedupeKey_active_key"
ON "AlertInstance"("dedupeKey")
WHERE "state" <> 'RESOLVED';

CREATE INDEX "AlertTransition_alertInstanceId_occurredAt_idx"
ON "AlertTransition"("alertInstanceId", "occurredAt");

ALTER TABLE "AlertInstance"
ADD CONSTRAINT "AlertInstance_ruleId_fkey"
FOREIGN KEY ("ruleId") REFERENCES "AlertRule"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AlertInstance"
ADD CONSTRAINT "AlertInstance_agentId_fkey"
FOREIGN KEY ("agentId") REFERENCES "Agent"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AlertTransition"
ADD CONSTRAINT "AlertTransition_alertInstanceId_fkey"
FOREIGN KEY ("alertInstanceId") REFERENCES "AlertInstance"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

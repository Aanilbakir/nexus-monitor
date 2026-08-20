CREATE TABLE "SystemMetricSample" (
    "id" BIGSERIAL NOT NULL,
    "agentId" UUID NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cpuPercent" DOUBLE PRECISION NOT NULL,
    "memoryTotalBytes" BIGINT NOT NULL,
    "memoryUsedBytes" BIGINT NOT NULL,
    "diskTotalBytes" BIGINT NOT NULL,
    "diskUsedBytes" BIGINT NOT NULL,
    "diskFreeBytes" BIGINT NOT NULL,
    "networkReceivedBytes" BIGINT NOT NULL,
    "networkTransmittedBytes" BIGINT NOT NULL,
    "uptimeSeconds" BIGINT NOT NULL,

    CONSTRAINT "SystemMetricSample_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SystemMetricSample_cpuPercent_check"
        CHECK ("cpuPercent" >= 0 AND "cpuPercent" <= 100),
    CONSTRAINT "SystemMetricSample_memory_check"
        CHECK ("memoryTotalBytes" >= 0 AND "memoryUsedBytes" >= 0 AND "memoryUsedBytes" <= "memoryTotalBytes"),
    CONSTRAINT "SystemMetricSample_disk_check"
        CHECK ("diskTotalBytes" >= 0 AND "diskUsedBytes" >= 0 AND "diskFreeBytes" >= 0 AND "diskUsedBytes" + "diskFreeBytes" <= "diskTotalBytes"),
    CONSTRAINT "SystemMetricSample_networkReceivedBytes_check"
        CHECK ("networkReceivedBytes" >= 0),
    CONSTRAINT "SystemMetricSample_networkTransmittedBytes_check"
        CHECK ("networkTransmittedBytes" >= 0),
    CONSTRAINT "SystemMetricSample_uptimeSeconds_check"
        CHECK ("uptimeSeconds" >= 0)
);

CREATE UNIQUE INDEX "SystemMetricSample_agentId_collectedAt_key"
ON "SystemMetricSample"("agentId", "collectedAt");

CREATE INDEX "SystemMetricSample_agentId_collectedAt_idx"
ON "SystemMetricSample"("agentId", "collectedAt" DESC);

CREATE INDEX "SystemMetricSample_receivedAt_idx"
ON "SystemMetricSample"("receivedAt");

ALTER TABLE "SystemMetricSample"
ADD CONSTRAINT "SystemMetricSample_agentId_fkey"
FOREIGN KEY ("agentId") REFERENCES "Agent"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

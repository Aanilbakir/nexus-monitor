import { cpus, freemem, totalmem, uptime } from 'node:os';

import { fsSize, networkStats } from 'systeminformation';

import type { CpuTimes } from './cpu.js';
import type {
  FilesystemMetric,
  MetricSource,
  NetworkMetric,
} from './system-metrics-collector.js';

const REMOTE_OR_VIRTUAL_FILESYSTEMS = new Set([
  '9p',
  'autofs',
  'cifs',
  'devfs',
  'devtmpfs',
  'fuse',
  'fuseblk',
  'nfs',
  'nfs4',
  'overlay',
  'proc',
  'smbfs',
  'squashfs',
  'sysfs',
  'tmpfs',
]);

export class SystemInformationProvider implements MetricSource {
  public readCpuTimes(): CpuTimes {
    return cpus().reduce(
      (aggregate, cpu) => {
        const total = Object.values(cpu.times).reduce(
          (sum, value) => sum + value,
          0,
        );
        return {
          idle: aggregate.idle + cpu.times.idle,
          total: aggregate.total + total,
        };
      },
      { idle: 0, total: 0 },
    );
  }

  public readMemory(): { totalBytes: number; usedBytes: number } {
    const totalBytes = totalmem();
    return { totalBytes, usedBytes: totalBytes - freemem() };
  }

  public readUptimeSeconds(): number {
    return uptime();
  }

  public async readFilesystems(): Promise<readonly FilesystemMetric[]> {
    return (await fsSize()).map((filesystem) => ({
      freeBytes: filesystem.available,
      local: isLocalFilesystem(filesystem.fs, filesystem.type),
      sizeBytes: filesystem.size,
      usedBytes: filesystem.used,
    }));
  }

  public async readNetworks(): Promise<readonly NetworkMetric[]> {
    return (await networkStats('*')).map((network) => ({
      active: network.operstate === 'up',
      loopback: /^(lo|loopback)/i.test(network.iface),
      receivedBytes: network.rx_bytes,
      transmittedBytes: network.tx_bytes,
    }));
  }
}

function isLocalFilesystem(filesystem: string, type: string): boolean {
  return (
    !filesystem.startsWith('//') &&
    !filesystem.startsWith('\\\\') &&
    !REMOTE_OR_VIRTUAL_FILESYSTEMS.has(type.toLowerCase())
  );
}

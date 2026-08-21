import { execFile } from 'node:child_process';
import { statfs } from 'node:fs/promises';
import { cpus, freemem, totalmem, uptime } from 'node:os';
import { platform } from 'node:process';
import { promisify } from 'node:util';

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
const executeFile = promisify(execFile);

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
    const filesystems = await fsSize();
    if (filesystems.length === 0 && platform === 'win32') {
      return readWindowsFixedFilesystems();
    }

    return filesystems.map((filesystem) => ({
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

export function parseWindowsDriveRoots(output: string): readonly string[] {
  const roots = [
    ...new Set(
      output
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter((line) => /^[A-Z]:\\$/iu.test(line)),
    ),
  ];
  if (roots.length === 0) {
    throw new Error('No fixed Windows drive is available.');
  }
  return roots;
}

async function readWindowsFixedFilesystems(): Promise<
  readonly FilesystemMetric[]
> {
  const command =
    "[System.IO.DriveInfo]::GetDrives() | Where-Object { $_.DriveType -eq 'Fixed' -and $_.IsReady } | ForEach-Object { $_.RootDirectory.FullName }";
  const { stdout } = await executeFile(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', command],
    { encoding: 'utf8', windowsHide: true },
  );

  return Promise.all(
    parseWindowsDriveRoots(stdout).map(async (root) => {
      const statistics = await statfs(root, { bigint: true });
      const size = statistics.bsize * statistics.blocks;
      const free = statistics.bsize * statistics.bfree;
      const available = statistics.bsize * statistics.bavail;
      return {
        freeBytes: safeNumber(available),
        local: true,
        sizeBytes: safeNumber(size),
        usedBytes: safeNumber(size - free),
      };
    }),
  );
}

function safeNumber(value: bigint): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new Error('Filesystem metric exceeds the safe integer range.');
  }
  return result;
}

function isLocalFilesystem(filesystem: string, type: string): boolean {
  return (
    !filesystem.startsWith('//') &&
    !filesystem.startsWith('\\\\') &&
    !REMOTE_OR_VIRTUAL_FILESYSTEMS.has(type.toLowerCase())
  );
}

/**
 * hardware-profiler.ts -- Detects GPU, VRAM, RAM, CPU, and disk.
 *
 * Decoupled from Electron: uses a pluggable GPUDetector interface instead of
 * app.getGPUInfo(), and accepts a configurable modelStoragePath instead of
 * app.getPath('userData').
 *
 * Originally from Agent Friday (Sprint 6 O.1: "The Nerves").
 */

import os from 'node:os';
import { statfs } from 'node:fs/promises';
import { execFile } from 'node:child_process';

import type {
  HardwareProfile,
  GPUInfo,
  VRAMInfo,
  RAMInfo,
  CPUInfo,
  DiskInfo,
  GPUDetector,
  HardwareProfilerConfig,
} from './types';

// -- Constants ---------------------------------------------------------------

/** Estimated VRAM reserved by desktop compositor (~1.5 GB). */
const SYSTEM_RESERVED_VRAM = 1.5 * 1024 * 1024 * 1024;

/** Well-known PCI vendor IDs. */
const VENDOR_NVIDIA = 0x10de;
const VENDOR_AMD = 0x1002;
const VENDOR_INTEL = 0x8086;
const VENDOR_APPLE = 0x106b;

// -- Event types ------------------------------------------------------------

type HardwareEvent = 'hardware-detected';
type HardwareCallback = (profile: HardwareProfile) => void;

// -- Helpers ----------------------------------------------------------------

/** Map a PCI vendor ID to a human-readable vendor string. */
function vendorFromId(vendorId: number): string {
  switch (vendorId) {
    case VENDOR_NVIDIA: return 'nvidia';
    case VENDOR_AMD:    return 'amd';
    case VENDOR_INTEL:  return 'intel';
    case VENDOR_APPLE:  return 'apple';
    default:            return 'unknown';
  }
}

/** Query nvidia-smi for GPU name, total VRAM (MB), and free VRAM (MB). */
function queryNvidiaSmi(): Promise<{ name: string; totalMB: number; freeMB: number } | null> {
  return new Promise((resolve) => {
    execFile(
      'nvidia-smi',
      ['--query-gpu=name,memory.total,memory.free', '--format=csv,noheader,nounits'],
      (err: Error | null, stdout: string) => {
        if (err || !stdout.trim()) {
          resolve(null);
          return;
        }
        const parts = stdout.trim().split(', ');
        if (parts.length < 3) {
          resolve(null);
          return;
        }
        resolve({
          name: parts[0],
          totalMB: parseInt(parts[1], 10) || 0,
          freeMB: parseInt(parts[2], 10) || 0,
        });
      },
    );
  });
}

// -- Default GPU Detector (nvidia-smi) --------------------------------------

/**
 * Default GPU detector that uses nvidia-smi to detect NVIDIA GPUs.
 *
 * Returns a single GPU device with NVIDIA vendor ID if nvidia-smi succeeds,
 * or null if nvidia-smi is not available or fails.
 */
export class NvidiaSmiDetector implements GPUDetector {
  async detect(): Promise<
    { vendorId: number; deviceId: number; driverVersion?: string }[] | null
  > {
    const result = await queryNvidiaSmi();
    if (!result) return null;
    return [{ vendorId: VENDOR_NVIDIA, deviceId: 0 }];
  }
}

// -- HardwareProfiler -------------------------------------------------------

export class HardwareProfiler {
  private cachedProfile: HardwareProfile | null = null;
  private listeners = new Map<HardwareEvent, HardwareCallback[]>();
  private modelStoragePath: string;
  private gpuDetector: GPUDetector;

  constructor(config: HardwareProfilerConfig = {}) {
    this.modelStoragePath = config.modelStoragePath ?? process.cwd();
    this.gpuDetector = config.gpuDetector ?? new NvidiaSmiDetector();
  }

  // -- Public API -----------------------------------------------------------

  /** Run full hardware detection, cache the result, and emit event. */
  async detect(): Promise<HardwareProfile> {
    if (this.cachedProfile) {
      return this.cachedProfile;
    }

    const [gpuResult, ramResult, cpuResult, diskResult] = await Promise.all([
      this.detectGPU(),
      this.detectRAM(),
      this.detectCPU(),
      this.detectDisk(),
    ]);

    const profile: HardwareProfile = {
      gpu: gpuResult.gpu,
      vram: gpuResult.vram,
      ram: ramResult,
      cpu: cpuResult,
      disk: diskResult,
      detectedAt: Date.now(),
    };

    this.cachedProfile = profile;
    this.emit('hardware-detected', profile);
    return profile;
  }

  /** Return the cached profile, or null if detect() has not been called. */
  getProfile(): HardwareProfile | null {
    return this.cachedProfile;
  }

  /** Force re-detection (clears cache first). */
  async refresh(): Promise<HardwareProfile> {
    this.cachedProfile = null;
    return this.detect();
  }

  /** Total VRAM minus system reserved (bytes). Returns 0 if no VRAM. */
  getEffectiveVRAM(): number {
    if (!this.cachedProfile) return 0;
    const { total } = this.cachedProfile.vram;
    if (total === 0) return 0;
    return Math.max(0, total - SYSTEM_RESERVED_VRAM);
  }

  /** Subscribe to events. Returns an unsubscribe function. */
  on(event: HardwareEvent, callback: HardwareCallback): () => void {
    const existing = this.listeners.get(event) ?? [];
    existing.push(callback);
    this.listeners.set(event, existing);

    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        this.listeners.set(
          event,
          callbacks.filter((cb) => cb !== callback),
        );
      }
    };
  }

  // -- Private detection methods --------------------------------------------

  private async detectGPU(): Promise<{ gpu: GPUInfo; vram: VRAMInfo }> {
    try {
      const devices = await this.gpuDetector.detect();

      if (!devices || devices.length === 0) {
        return {
          gpu: { name: 'Unknown', vendor: 'unknown', driver: '', available: false },
          vram: { total: 0, available: 0, systemReserved: 0 },
        };
      }

      const primary = devices[0];
      const vendor = vendorFromId(primary.vendorId);
      const driver = primary.driverVersion ?? '';

      // For NVIDIA, try nvidia-smi for name and VRAM
      if (vendor === 'nvidia') {
        const smiResult = await queryNvidiaSmi();
        if (smiResult) {
          const totalBytes = smiResult.totalMB * 1024 * 1024;
          const availableBytes = smiResult.freeMB * 1024 * 1024;
          return {
            gpu: {
              name: smiResult.name,
              vendor,
              driver,
              available: true,
            },
            vram: {
              total: totalBytes,
              available: availableBytes,
              systemReserved: SYSTEM_RESERVED_VRAM,
            },
          };
        }
        // nvidia-smi failed but vendor is nvidia
        return {
          gpu: { name: 'NVIDIA GPU', vendor, driver, available: true },
          vram: { total: 0, available: 0, systemReserved: SYSTEM_RESERVED_VRAM },
        };
      }

      // Non-NVIDIA GPU: available but VRAM is unreliable
      return {
        gpu: { name: `${vendor.toUpperCase()} GPU`, vendor, driver, available: true },
        vram: { total: 0, available: 0, systemReserved: 0 },
      };
    } catch {
      return {
        gpu: { name: 'Unknown', vendor: 'unknown', driver: '', available: false },
        vram: { total: 0, available: 0, systemReserved: 0 },
      };
    }
  }

  private detectRAM(): RAMInfo {
    return {
      total: os.totalmem(),
      available: os.freemem(),
    };
  }

  private detectCPU(): CPUInfo {
    const cpuList = os.cpus();
    const model = cpuList[0]?.model ?? 'Unknown';
    const threads = cpuList.length;
    const cores = Math.max(1, Math.floor(threads / 2));
    return { model, cores, threads };
  }

  private async detectDisk(): Promise<DiskInfo> {
    const modelPath = this.modelStoragePath;
    try {
      const stats = await statfs(modelPath);
      return {
        modelStoragePath: modelPath,
        totalSpace: stats.blocks * stats.bsize,
        freeSpace: stats.bavail * stats.bsize,
      };
    } catch {
      return {
        modelStoragePath: modelPath,
        totalSpace: 0,
        freeSpace: 0,
      };
    }
  }

  // -- Private event helpers ------------------------------------------------

  private emit(event: HardwareEvent, payload: HardwareProfile): void {
    const callbacks = this.listeners.get(event) ?? [];
    for (const cb of callbacks) {
      cb(payload);
    }
  }
}

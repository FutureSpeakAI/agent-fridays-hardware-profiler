/**
 * types.ts -- Shared type definitions for hardware profiling and tier recommendation.
 *
 * All interfaces and type aliases used across the package are defined here
 * to avoid circular dependencies and provide a single source of truth.
 */

// -- Hardware Profile Types --------------------------------------------------

export interface HardwareProfile {
  gpu: GPUInfo;
  vram: VRAMInfo;
  ram: RAMInfo;
  cpu: CPUInfo;
  disk: DiskInfo;
  detectedAt: number;
}

export interface GPUInfo {
  name: string;
  vendor: string;
  driver: string;
  available: boolean;
}

export interface VRAMInfo {
  total: number;
  available: number;
  systemReserved: number;
}

export interface RAMInfo {
  total: number;
  available: number;
}

export interface CPUInfo {
  model: string;
  cores: number;
  threads: number;
}

export interface DiskInfo {
  modelStoragePath: string;
  totalSpace: number;
  freeSpace: number;
}

// -- Tier Recommendation Types -----------------------------------------------

export type TierName = 'whisper' | 'light' | 'standard' | 'full' | 'sovereign';

export type ModelCategory =
  | 'llm'
  | 'embedding'
  | 'vision'
  | 'tts'
  | 'stt'
  | 'diffusion'
  | 'audio';

export interface TierRecommendation {
  tier: TierName;
  models: ModelRequirement[];
  totalVRAM: number;
  totalDisk: number;
  diskSufficient: boolean;
  vramHeadroom: number;
  upgradePath: UpgradePath | null;
  warnings: string[];
}

export interface ModelRequirement {
  name: string;
  vramBytes: number;
  diskBytes: number;
  purpose: string;
  required: boolean;
  category?: ModelCategory;
  cpuOnly?: boolean;
}

export interface UpgradePath {
  nextTier: TierName;
  requiredVRAM: number;
  requiredDisk: number;
  unlocks: string[];
}

// -- GPU Detector Interface --------------------------------------------------

/**
 * Pluggable GPU detection strategy.
 *
 * Implementations return an array of detected GPU devices (PCI vendor/device IDs)
 * or null if no GPU can be detected.
 *
 * The default implementation (NvidiaSmiDetector) uses nvidia-smi.
 * In Electron apps, you can implement this using app.getGPUInfo('complete').
 */
export interface GPUDetector {
  detect(): Promise<
    { vendorId: number; deviceId: number; driverVersion?: string }[] | null
  >;
}

// -- Profiler Configuration --------------------------------------------------

export interface HardwareProfilerConfig {
  /**
   * Path where AI models are stored. Used to check available disk space.
   * Defaults to the current working directory if not specified.
   */
  modelStoragePath?: string;

  /**
   * Pluggable GPU detection strategy.
   * Defaults to NvidiaSmiDetector if not specified.
   */
  gpuDetector?: GPUDetector;
}

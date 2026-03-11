/**
 * @agent-friday/hardware-profiler
 *
 * Hardware detection and AI model tier recommendation system.
 * Detects GPU/VRAM/RAM/CPU/disk and recommends which AI models can run locally
 * using a 5-tier system (whisper -> light -> standard -> full -> sovereign).
 *
 * Extracted from Agent Friday — the world's most trustworthy AI assistant, by FutureSpeakAI.
 */

// -- Types -------------------------------------------------------------------
export type {
  HardwareProfile,
  GPUInfo,
  VRAMInfo,
  RAMInfo,
  CPUInfo,
  DiskInfo,
  TierName,
  ModelCategory,
  TierRecommendation,
  ModelRequirement,
  UpgradePath,
  GPUDetector,
  HardwareProfilerConfig,
} from './types';

// -- Hardware Profiler -------------------------------------------------------
export { HardwareProfiler, NvidiaSmiDetector } from './hardware-profiler';

// -- Tier Recommender (pure functions) ---------------------------------------
export {
  getTier,
  getModelList,
  getModelsByCategory,
  estimateVRAMUsage,
  estimateDiskUsage,
  canFitModel,
  getUpgradePath,
  recommend,
  getModelInfo,
  getAllModelNames,
} from './tier-recommender';

# Agent Friday's Hardware Profiler

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

Detects your system's GPU, VRAM, RAM, CPU, and available disk space, then recommends which AI models can run locally using a 5-tier system (whisper → light → standard → full → sovereign). Each tier specifies exact model requirements with VRAM and disk budgets, CPU-only model support (TTS/STT), and clear upgrade paths showing what hardware improvements unlock which capabilities.

Extracted from [Agent Friday](https://github.com/FutureSpeakAI/Agent-Friday), an AGI desktop OS by FutureSpeakAI.

## Why This Matters

The biggest barrier to running AI locally isn't the models — it's knowing what your hardware can actually handle. Users download a 40GB model only to find their GPU can't load it, or they avoid local AI entirely because they don't know they have enough VRAM for a perfectly capable 8B model.

This package solves the discovery problem. It profiles your system's GPU, VRAM, RAM, CPU, and disk space, then maps that hardware to a concrete tier with specific model recommendations. Instead of "you have 8GB of VRAM," it tells you "you're in the **full** tier — you can run Llama 8B for chat, Moondream for image understanding, Kokoro for multilingual text-to-speech, and Stable Diffusion 1.5 for image generation, with 1.3GB of VRAM headroom."

The tier system also provides **upgrade paths** — if you're at the standard tier, it tells you exactly what hardware upgrade would unlock vision models and image generation, making the cost/benefit of a GPU upgrade concrete and actionable.

If you're building a desktop AI application and need to automatically determine what to run locally vs. send to the cloud, this gives you the hardware-to-model mapping layer.

## The 5 Tiers

| Tier | Min VRAM | Models | Capabilities |
|------|----------|--------|-------------|
| whisper | 0 GB | None | API-only mode |
| light | 2 GB | Embeddings, Piper TTS, Whisper STT | Semantic search, basic voice |
| standard | 6 GB | + Llama 8B, better STT | Offline chat, local reasoning |
| full | 8 GB | + Moondream vision, Kokoro TTS, SD 1.5 | Image understanding, image gen |
| sovereign | 16 GB | + Llama 70B, SDXL Turbo, best STT | Full local AI sovereignty |

## Installation

```bash
npm install github:FutureSpeakAI/agent-fridays-hardware-profiler
```

## Quick Start

### Detect Hardware and Get Recommendation

```typescript
import { HardwareProfiler, recommend } from '@agent-friday/hardware-profiler';

const profiler = new HardwareProfiler({
  modelStoragePath: '/path/to/your/models',
});

const profile = await profiler.detect();
const recommendation = recommend(profile);

console.log(`Tier: ${recommendation.tier}`);
console.log(`Models: ${recommendation.models.map(m => m.name).join(', ')}`);
console.log(`VRAM headroom: ${(recommendation.vramHeadroom / 1e9).toFixed(1)} GB`);
console.log(`Disk sufficient: ${recommendation.diskSufficient}`);
```

### Check Model Compatibility

```typescript
import { HardwareProfiler, getModelInfo, canFitModel } from '@agent-friday/hardware-profiler';

const profiler = new HardwareProfiler();
const profile = await profiler.detect();

const llama8b = getModelInfo('llama3.1:8b-instruct-q4_K_M');
if (llama8b && canFitModel(llama8b, profile)) {
  console.log('Llama 8B can run on this system!');
}
```

### View Upgrade Path

```typescript
import { HardwareProfiler, recommend } from '@agent-friday/hardware-profiler';

const profiler = new HardwareProfiler();
const profile = await profiler.detect();
const rec = recommend(profile);

if (rec.upgradePath) {
  const vramGB = (rec.upgradePath.requiredVRAM / 1e9).toFixed(0);
  console.log(`Upgrade to "${rec.upgradePath.nextTier}" tier with ${vramGB} GB VRAM`);
  console.log(`Unlocks: ${rec.upgradePath.unlocks.join(', ')}`);
}
```

### Filter Models by Category

```typescript
import { getModelsByCategory } from '@agent-friday/hardware-profiler';

// Get all TTS models available at the "full" tier
const ttsModels = getModelsByCategory('full', 'tts');
console.log('TTS models:', ttsModels.map(m => m.name));

// Get all STT models available at the "sovereign" tier
const sttModels = getModelsByCategory('sovereign', 'stt');
console.log('STT models:', sttModels.map(m => m.name));
```

### Custom GPU Detector

The default detector uses `nvidia-smi`. You can provide your own (e.g., for Electron apps):

```typescript
import { HardwareProfiler, GPUDetector } from '@agent-friday/hardware-profiler';

class ElectronGPUDetector implements GPUDetector {
  async detect() {
    const { app } = require('electron');
    const info = await app.getGPUInfo('complete') as any;
    return info?.gpuDevice ?? null;
  }
}

const profiler = new HardwareProfiler({
  gpuDetector: new ElectronGPUDetector(),
  modelStoragePath: '/path/to/models',
});
```

## Model Registry

All supported models with their requirements:

| Model | Category | VRAM | Disk | CPU-Only | Purpose |
|-------|----------|------|------|----------|---------|
| `nomic-embed-text` | embedding | 0.5 GB | 0.3 GB | No | Text embeddings for semantic search |
| `llama3.1:8b-instruct-q4_K_M` | llm | 5.5 GB | 4.7 GB | No | Local language model for chat and reasoning |
| `llama3.1:70b-instruct-q4_K_M` | llm | 40 GB | 40 GB | No | Large language model for complex reasoning |
| `moondream:latest` | vision | 1.2 GB | 0.8 GB | No | Vision-language model for image understanding |
| `piper-en-us-lessac-medium` | tts | 0 | 63 MB | Yes | Local text-to-speech (English, medium quality) |
| `kokoro-v1.0` | tts | 0 | 350 MB | Yes | Local text-to-speech (multilingual, high quality) |
| `whisper-ggml-tiny` | stt | 0 | 75 MB | Yes | Local speech-to-text (fast, lower accuracy) |
| `whisper-ggml-base` | stt | 0 | 142 MB | Yes | Local speech-to-text (balanced speed/accuracy) |
| `whisper-ggml-small` | stt | 0 | 466 MB | Yes | Local speech-to-text (good accuracy) |
| `whisper-ggml-medium` | stt | 0 | 1.5 GB | Yes | Local speech-to-text (high accuracy) |
| `sd-1.5-q8` | diffusion | 4 GB | 2 GB | No | Local image generation (Stable Diffusion 1.5) |
| `sdxl-turbo-q4` | diffusion | 6 GB | 3.5 GB | No | Local image generation (SDXL Turbo, fast) |

## API Reference

### `HardwareProfiler`

**Constructor:** `new HardwareProfiler(config?)`

| Config Option | Type | Default | Description |
|---------------|------|---------|-------------|
| `modelStoragePath` | `string` | `process.cwd()` | Path where AI models are stored (used for disk space checks) |
| `gpuDetector` | `GPUDetector` | `NvidiaSmiDetector` | Pluggable GPU detection strategy |

**Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `detect()` | `Promise<HardwareProfile>` | Run full hardware detection (cached after first call) |
| `refresh()` | `Promise<HardwareProfile>` | Force re-detection (clears cache) |
| `getProfile()` | `HardwareProfile \| null` | Return cached profile or null |
| `getEffectiveVRAM()` | `number` | Total VRAM minus system reserved (~1.5 GB) |
| `on(event, callback)` | `() => void` | Subscribe to `'hardware-detected'` event; returns unsubscribe function |

### Tier Recommender (pure functions)

| Function | Description |
|----------|-------------|
| `recommend(profile)` | Full tier recommendation with models, disk check, warnings, and upgrade path |
| `getTier(profile)` | Determine tier name from VRAM |
| `getModelList(tier)` | Get all models for a tier |
| `getModelsByCategory(tier, category)` | Filter tier models by category |
| `estimateVRAMUsage(models)` | Sum VRAM for an array of models (excludes CPU-only) |
| `estimateDiskUsage(models)` | Sum disk for an array of models |
| `canFitModel(model, profile, loaded?)` | Check if a model fits in available VRAM |
| `getUpgradePath(tier)` | Get upgrade path for a tier (or null for sovereign) |
| `getModelInfo(name)` | Look up a model by name from the registry |
| `getAllModelNames()` | Get all registered model names |

### Interfaces

| Interface | Description |
|-----------|-------------|
| `GPUDetector` | Pluggable GPU detection: `{ detect(): Promise<{ vendorId, deviceId, driverVersion? }[] \| null> }` |
| `HardwareProfile` | Full hardware snapshot: GPU, VRAM, RAM, CPU, disk |
| `TierRecommendation` | Tier + models + disk check + warnings + upgrade path |
| `ModelRequirement` | Model name, VRAM/disk bytes, purpose, category, CPU-only flag |
| `UpgradePath` | Next tier, required VRAM/disk, unlocked capabilities |

### Types

| Type | Values |
|------|--------|
| `TierName` | `'whisper' \| 'light' \| 'standard' \| 'full' \| 'sovereign'` |
| `ModelCategory` | `'llm' \| 'embedding' \| 'vision' \| 'tts' \| 'stt' \| 'diffusion' \| 'audio'` |

## Part of Agent Friday

This package is extracted from [Agent Friday](https://github.com/FutureSpeakAI/Agent-Friday), an AGI desktop OS that runs AI models locally. The hardware profiler and tier recommender are the foundation of Agent Friday's automatic model management system.

## License

[MIT](./LICENSE) -- Copyright (c) 2025 FutureSpeakAI

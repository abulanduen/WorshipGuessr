import {
  CLIP_LEAD_IN_SECONDS,
  CLIP_PROBE_WINDOW_SECONDS,
  CLIP_SKIP_END_FRACTION,
  CLIP_SKIP_START_FRACTION,
} from "./constants";

const HOP_SECONDS = 0.5;

/**
 * Loudness-based stand-in for real chorus detection: slides a ~9s window
 * across short-time RMS energy (skipping intro/outro) to find the loudest
 * sustained stretch, then backs up ~1.5s as a lead-in pickup point.
 */
export function findChorusStart(samples: Int16Array, sampleRate: number, totalDuration: number): number {
  const hopSize = Math.max(1, Math.round(HOP_SECONDS * sampleRate));
  const hopCount = Math.floor(samples.length / hopSize);

  if (hopCount < 4) return 0;

  const energies: number[] = new Array(hopCount);
  for (let h = 0; h < hopCount; h++) {
    let sumSquares = 0;
    const start = h * hopSize;
    const end = start + hopSize;
    for (let i = start; i < end; i++) {
      const s = samples[i] / 32768;
      sumSquares += s * s;
    }
    energies[h] = Math.sqrt(sumSquares / hopSize);
  }

  const skipStart = Math.floor(hopCount * CLIP_SKIP_START_FRACTION);
  const skipEnd = Math.floor(hopCount * CLIP_SKIP_END_FRACTION);
  const probeHops = Math.max(1, Math.round(CLIP_PROBE_WINDOW_SECONDS / HOP_SECONDS));

  const lastWindowStart = hopCount - skipEnd - probeHops;
  const firstWindowStart = skipStart;

  if (lastWindowStart <= firstWindowStart) {
    // Track too short for the full probe window; fall back to the loudest single hop.
    let bestHop = firstWindowStart;
    let bestEnergy = -Infinity;
    for (let h = firstWindowStart; h < hopCount - skipEnd; h++) {
      if (energies[h] > bestEnergy) {
        bestEnergy = energies[h];
        bestHop = h;
      }
    }
    const onset = Math.max(0, bestHop * HOP_SECONDS - CLIP_LEAD_IN_SECONDS);
    return Math.min(onset, Math.max(0, totalDuration - 1));
  }

  // Running-sum slide across candidate windows.
  let windowSum = 0;
  for (let h = firstWindowStart; h < firstWindowStart + probeHops; h++) windowSum += energies[h];

  let bestStart = firstWindowStart;
  let bestSum = windowSum;

  for (let start = firstWindowStart + 1; start <= lastWindowStart; start++) {
    windowSum += energies[start + probeHops - 1] - energies[start - 1];
    if (windowSum > bestSum) {
      bestSum = windowSum;
      bestStart = start;
    }
  }

  const onsetSeconds = bestStart * HOP_SECONDS;
  const pickup = Math.max(0, onsetSeconds - CLIP_LEAD_IN_SECONDS);
  return pickup;
}

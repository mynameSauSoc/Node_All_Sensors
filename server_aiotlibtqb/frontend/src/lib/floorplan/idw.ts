export interface IdwSamplePoint {
  x: number;
  y: number;
  value: number;
  online?: boolean;
}

/**
 * Pure Inverse Distance Weighting (IDW) interpolation (FE-VIZ-04, FE-VIZ-05).
 * Uses only ONLINE devices with finite numeric values.
 */
export function computeIdwValue(
  targetX: number,
  targetY: number,
  samples: readonly IdwSamplePoint[],
  epsilon = 1e-6
): number | null {
  const validSamples = samples.filter(
    (s) =>
      s.online !== false &&
      typeof s.value === 'number' &&
      Number.isFinite(s.value) &&
      typeof s.x === 'number' &&
      typeof s.y === 'number'
  );

  if (validSamples.length === 0) {
    return null;
  }

  if (validSamples.length === 1) {
    return validSamples[0].value;
  }

  let weightedSum = 0;
  let totalWeight = 0;

  for (const s of validSamples) {
    const dx = targetX - s.x;
    const dy = targetY - s.y;
    const distSq = dx * dx + dy * dy;
    if (distSq < epsilon) {
      return s.value;
    }
    const weight = 1 / (distSq + epsilon);
    weightedSum += weight * s.value;
    totalWeight += weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : null;
}

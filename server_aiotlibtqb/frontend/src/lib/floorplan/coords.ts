import type { Point2D } from '@/types/api';

/**
 * Coordinate conversion between normalized [0.0, 1.0] space and Canvas pixels (FE-VIZ-02, FE-VIZ-06).
 */
export function normalizedToPixel(
  point: Point2D,
  canvasWidth: number,
  canvasHeight: number
): Point2D {
  return {
    x: Math.max(0, Math.min(1, point.x)) * canvasWidth,
    y: Math.max(0, Math.min(1, point.y)) * canvasHeight,
  };
}

export function pixelToNormalized(
  pixel: Point2D,
  canvasWidth: number,
  canvasHeight: number
): Point2D {
  if (canvasWidth <= 0 || canvasHeight <= 0) {
    return { x: 0, y: 0 };
  }
  return {
    x: Number(Math.max(0, Math.min(1, pixel.x / canvasWidth)).toFixed(4)),
    y: Number(Math.max(0, Math.min(1, pixel.y / canvasHeight)).toFixed(4)),
  };
}

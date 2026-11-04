import type { Point2D } from '@/types/api';

function ccw(a: Point2D, b: Point2D, c: Point2D): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function pointOnSegment(p: Point2D, a: Point2D, b: Point2D): boolean {
  const cross = Math.abs(ccw(a, b, p));
  if (cross > 1e-7) return false;
  const minX = Math.min(a.x, b.x) - 1e-7;
  const maxX = Math.max(a.x, b.x) + 1e-7;
  const minY = Math.min(a.y, b.y) - 1e-7;
  const maxY = Math.max(a.y, b.y) + 1e-7;
  return p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY;
}

function segmentsProperlyIntersect(
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  p4: Point2D
): boolean {
  const d1 = ccw(p3, p4, p1);
  const d2 = ccw(p3, p4, p2);
  const d3 = ccw(p1, p2, p3);
  const d4 = ccw(p1, p2, p4);

  if (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  ) {
    return true;
  }

  return (
    pointOnSegment(p1, p3, p4) ||
    pointOnSegment(p2, p3, p4) ||
    pointOnSegment(p3, p1, p2) ||
    pointOnSegment(p4, p1, p2)
  );
}

/**
 * Computes signed area of a 2D polygon using the Shoelace formula.
 */
export function computePolygonSignedArea(polygon: readonly Point2D[]): number {
  if (!polygon || polygon.length < 3) return 0;
  let area2 = 0;
  for (let i = 0; i < polygon.length; i++) {
    const cur = polygon[i];
    const next = polygon[(i + 1) % polygon.length];
    area2 += cur.x * next.y - next.x * cur.y;
  }
  return area2 * 0.5;
}

/**
 * Validates that a boundary polygon has >= 3 vertices, coordinates in [0.0, 1.0],
 * non-zero area, no duplicate vertices, and no self-intersecting edges (FE-VIZ-08, FE-GEO-01).
 */
export function validateBoundaryPolygon(polygon: readonly Point2D[]): {
  valid: boolean;
  reason?: string;
} {
  if (!polygon || polygon.length < 3) {
    return { valid: false, reason: 'Đa giác phòng phải có ít nhất 3 đỉnh.' };
  }

  for (const pt of polygon) {
    if (
      typeof pt.x !== 'number' ||
      typeof pt.y !== 'number' ||
      !Number.isFinite(pt.x) ||
      !Number.isFinite(pt.y) ||
      pt.x < 0 ||
      pt.x > 1 ||
      pt.y < 0 ||
      pt.y > 1
    ) {
      return {
        valid: false,
        reason: 'Tọa độ đỉnh đa giác phải nằm trong khoảng chuẩn hóa [0.0, 1.0].',
      };
    }
  }

  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dist = Math.hypot(
        polygon[i].x - polygon[j].x,
        polygon[i].y - polygon[j].y
      );
      if (dist < 1e-4) {
        return {
          valid: false,
          reason: 'Các đỉnh của đa giác không được trùng nhau.',
        };
      }
    }
  }

  for (let i = 0; i < n; i++) {
    const a1 = polygon[i];
    const a2 = polygon[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      // Skip adjacent edges sharing a vertex
      if (i === 0 && j === n - 1) continue;
      const b1 = polygon[j];
      const b2 = polygon[(j + 1) % n];
      if (segmentsProperlyIntersect(a1, a2, b1, b2)) {
        return {
          valid: false,
          reason: 'Các cạnh của đa giác không được tự cắt nhau.',
        };
      }
    }
  }

  const area = Math.abs(computePolygonSignedArea(polygon));
  if (area < 1e-4) {
    return {
      valid: false,
      reason: 'Đa giác suy biến (các đỉnh thẳng hàng hoặc diện tích quá nhỏ).',
    };
  }

  return { valid: true };
}

/**
 * Ray-casting algorithm to verify whether a point (posX, posY) lies inside a polygon (FE-VIZ-08).
 */
export function isPointInPolygon(
  point: Point2D,
  polygon: readonly Point2D[]
): boolean {
  if (!polygon || polygon.length < 3) return false;

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Computes an interior visual label point for convex or concave (L/U-shaped) polygons (FE-GEO-02).
 */
export function computeVisualPolygonCenter(
  polygon: readonly Point2D[]
): Point2D {
  if (!polygon || polygon.length === 0) return { x: 0.5, y: 0.5 };
  if (polygon.length < 3) {
    const sx = polygon.reduce((acc, p) => acc + p.x, 0);
    const sy = polygon.reduce((acc, p) => acc + p.y, 0);
    return { x: sx / polygon.length, y: sy / polygon.length };
  }

  let areaAcc = 0;
  let cx = 0;
  let cy = 0;
  const n = polygon.length;

  for (let i = 0; i < n; i++) {
    const p0 = polygon[i];
    const p1 = polygon[(i + 1) % n];
    const cross = p0.x * p1.y - p1.x * p0.y;
    areaAcc += cross;
    cx += (p0.x + p1.x) * cross;
    cy += (p0.y + p1.y) * cross;
  }

  let centroid: Point2D;
  if (Math.abs(areaAcc) > 1e-6) {
    centroid = {
      x: cx / (3 * areaAcc),
      y: cy / (3 * areaAcc),
    };
  } else {
    centroid = {
      x: polygon.reduce((acc, p) => acc + p.x, 0) / n,
      y: polygon.reduce((acc, p) => acc + p.y, 0) / n,
    };
  }

  if (isPointInPolygon(centroid, polygon)) {
    return centroid;
  }

  // Fallback for concave polygons (e.g. L/U shapes): search candidate interior chords
  let bestPoint: Point2D | null = null;
  let bestDist = Number.POSITIVE_INFINITY;

  const consider = (candidate: Point2D) => {
    if (!isPointInPolygon(candidate, polygon)) return;
    const d = Math.hypot(candidate.x - centroid.x, candidate.y - centroid.y);
    if (d < bestDist) {
      bestDist = d;
      bestPoint = candidate;
    }
  };

  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      consider({
        x: (polygon[i].x + polygon[j].x) * 0.5,
        y: (polygon[i].y + polygon[j].y) * 0.5,
      });
    }
    const edgeMid = {
      x: (polygon[i].x + polygon[(i + 1) % n].x) * 0.5,
      y: (polygon[i].y + polygon[(i + 1) % n].y) * 0.5,
    };
    for (let k = 0; k < n; k++) {
      consider({
        x: (edgeMid.x + polygon[k].x) * 0.5,
        y: (edgeMid.y + polygon[k].y) * 0.5,
      });
    }
  }

  return bestPoint ?? polygon[0];
}

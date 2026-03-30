/**
 * Bezier curve and dribbling wave algorithms for OCF line rendering.
 * Implements the FIBA CurvedPathMaths algorithm.
 */

/**
 * Compute angle bisector control points for quadratic bezier interpolation.
 * For waypoints P0, P1, ..., Pn:
 * At each interior point Pi, compute angle bisector of incoming/outgoing vectors.
 * 
 * @param {Array<{x:number, y:number}>} points - Waypoints
 * @returns {string} SVG path data
 */
export function curvedPath(points) {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`;
  }

  let d = `M ${points[0].x},${points[0].y}`;

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    // Vectors from curr to prev and curr to next
    const v1x = prev.x - curr.x;
    const v1y = prev.y - curr.y;
    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;

    const len1 = Math.sqrt(v1x * v1x + v1y * v1y);
    const len2 = Math.sqrt(v2x * v2x + v2y * v2y);

    if (len1 === 0 || len2 === 0) {
      d += ` L ${curr.x},${curr.y}`;
      continue;
    }

    // Normalized vectors
    const n1x = v1x / len1, n1y = v1y / len1;
    const n2x = v2x / len2, n2y = v2y / len2;

    // Bisector direction (pointing "outward" from the angle)
    const bx = n1x + n2x;
    const by = n1y + n2y;
    const bLen = Math.sqrt(bx * bx + by * by);

    if (bLen < 0.001) {
      // Points are collinear, use straight line to midpoints
      const mid1x = (prev.x + curr.x) / 2;
      const mid1y = (prev.y + curr.y) / 2;
      d += ` L ${mid1x},${mid1y} L ${curr.x},${curr.y}`;
      continue;
    }

    // Control point offset along bisector
    const controlDist = Math.min(len1, len2) * 0.3;
    const cx = curr.x + (bx / bLen) * controlDist;
    const cy = curr.y + (by / bLen) * controlDist;

    // Midpoints for smooth transitions
    const mid1x = (prev.x + curr.x) / 2;
    const mid1y = (prev.y + curr.y) / 2;

    if (i === 1) {
      d += ` Q ${cx},${cy} ${curr.x},${curr.y}`;
    } else {
      d += ` Q ${cx},${cy} ${curr.x},${curr.y}`;
    }
  }

  // Last segment
  const last = points[points.length - 1];
  d += ` L ${last.x},${last.y}`;

  return d;
}

/**
 * Generate a straight polyline path.
 * @param {Array<{x:number, y:number}>} points
 * @returns {string} SVG path data
 */
export function straightPath(points) {
  if (points.length < 2) return '';
  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x},${points[i].y}`;
  }
  return d;
}

/**
 * Generate a dribbling wave path (sinusoidal wave perpendicular to direction).
 * Wavelength ≈ 5 OCF units, amplitude ≈ 1.5 OCF units.
 * 
 * @param {Array<{x:number, y:number}>} points - Waypoints
 * @param {number} scale - Pixels per OCF unit (for converting wavelength/amplitude)
 * @returns {string} SVG path data
 */
export function dribblingPath(points, scale = 1) {
  if (points.length < 2) return '';

  // Flatten to a single line through all points
  const segments = [];
  for (let i = 0; i < points.length - 1; i++) {
    segments.push({ from: points[i], to: points[i + 1] });
  }

  // Total length in SVG pixels
  let totalLen = 0;
  for (const seg of segments) {
    const dx = seg.to.x - seg.from.x;
    const dy = seg.to.y - seg.from.y;
    totalLen += Math.sqrt(dx * dx + dy * dy);
  }

  const wavelength = 5 * scale;
  const amplitude = 1.2 * scale;
  const numWaves = Math.max(2, Math.round(totalLen / wavelength));
  const segLen = totalLen / numWaves;

  // Walk along path and create wave control points
  let d = `M ${points[0].x},${points[0].y}`;
  let walked = 0;
  let segIdx = 0;
  let segWalked = 0;
  let side = 1;

  for (let w = 0; w < numWaves; w++) {
    const halfTarget = walked + segLen / 2;
    const endTarget = walked + segLen;

    // Find midpoint along path
    const mid = pointAlongPath(segments, halfTarget);
    const end = pointAlongPath(segments, endTarget);

    // Direction at midpoint
    const seg = segments[Math.min(segIdx, segments.length - 1)];
    const dx = seg.to.x - seg.from.x;
    const dy = seg.to.y - seg.from.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;

    // Perpendicular
    const px = -dy / len;
    const py = dx / len;

    const cx = mid.x + px * amplitude * side;
    const cy = mid.y + py * amplitude * side;

    d += ` Q ${cx},${cy} ${end.x},${end.y}`;
    side *= -1;
    walked = endTarget;
  }

  return d;
}

/**
 * Find a point at a given distance along a series of segments.
 */
function pointAlongPath(segments, distance) {
  let remaining = distance;
  for (const seg of segments) {
    const dx = seg.to.x - seg.from.x;
    const dy = seg.to.y - seg.from.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (remaining <= len || seg === segments[segments.length - 1]) {
      const t = len > 0 ? Math.min(remaining / len, 1) : 0;
      return { x: seg.from.x + dx * t, y: seg.from.y + dy * t };
    }
    remaining -= len;
  }
  const last = segments[segments.length - 1];
  return { x: last.to.x, y: last.to.y };
}

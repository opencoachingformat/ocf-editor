/**
 * Bezier curve and dribbling wave algorithms for OCF line rendering.
 * Implements the FIBA CurvedPathMaths algorithm.
 */

/**
 * Smooth quadratic spline through a set of waypoints.
 *
 * Each interior waypoint becomes the control point of a quadratic Bézier, and
 * consecutive spans are joined at the segment midpoints so the curve passes
 * smoothly *through* the waypoints and bulges toward them (the intuitive
 * "outward" direction the author drew). The first span starts at P0 and the
 * last span ends exactly on Pn, so endpoints are honored.
 *
 * @param {Array<{x:number, y:number}>} points - Waypoints
 * @returns {string} SVG path data
 */
export function curvedPath(points) {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`;
  }

  const n = points.length;
  let d = `M ${points[0].x},${points[0].y}`;

  for (let i = 1; i < n - 1; i++) {
    const ctrl = points[i];
    // End each span at the midpoint to the next waypoint, except the final span
    // which lands on the last point.
    const end = (i === n - 2)
      ? points[n - 1]
      : { x: (points[i].x + points[i + 1].x) / 2, y: (points[i].y + points[i + 1].y) / 2 };
    d += ` Q ${ctrl.x},${ctrl.y} ${end.x},${end.y}`;
  }

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
  let side = 1;

  for (let w = 0; w < numWaves; w++) {
    const halfTarget = walked + segLen / 2;
    const endTarget = walked + segLen;

    // Midpoint of this wave, plus the tangent of whichever segment it lies on —
    // so the perpendicular follows bends in the path instead of always using
    // the first segment's direction.
    const mid = pointAlongPath(segments, halfTarget);
    const end = pointAlongPath(segments, endTarget);

    // Perpendicular to the local tangent at the midpoint
    const px = -mid.ty;
    const py = mid.tx;

    const cx = mid.x + px * amplitude * side;
    const cy = mid.y + py * amplitude * side;

    d += ` Q ${cx},${cy} ${end.x},${end.y}`;
    side *= -1;
    walked = endTarget;
  }

  return d;
}

/**
 * Find a point at a given distance along a series of segments, together with the
 * unit tangent (tx, ty) of the segment it falls on.
 */
function pointAlongPath(segments, distance) {
  let remaining = distance;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const dx = seg.to.x - seg.from.x;
    const dy = seg.to.y - seg.from.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const tx = len > 0 ? dx / len : 0;
    const ty = len > 0 ? dy / len : 0;
    if (remaining <= len || i === segments.length - 1) {
      const t = len > 0 ? Math.min(remaining / len, 1) : 0;
      return { x: seg.from.x + dx * t, y: seg.from.y + dy * t, tx, ty };
    }
    remaining -= len;
  }
  const last = segments[segments.length - 1];
  const dx = last.to.x - last.from.x;
  const dy = last.to.y - last.from.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  return { x: last.to.x, y: last.to.y, tx: dx / len, ty: dy / len };
}

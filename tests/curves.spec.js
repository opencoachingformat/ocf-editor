/**
 * Geometric unit tests for the curve renderers (pure functions — no browser).
 *
 * Focus: the reported rendering bugs —
 *   - curved movement lines bulged toward the *inside* of a bend (and were
 *     half-straight) instead of passing smoothly through the waypoint;
 *   - dribbling waves used the first segment's direction for every wave, so
 *     after a bend the zig-zag pointed the wrong way.
 */

import { test, expect } from '@playwright/test';
import { curvedPath, straightPath, dribblingPath } from '../src/court/curves.js';

// ─── Tiny SVG-path sampler (supports the M / L / Q we emit) ─────────────────────

/** Parse "M/L/Q" path data into a list of commands with numeric args. */
function parsePath(d) {
  const tokens = d.match(/[MLQ][^MLQ]*/g) || [];
  return tokens.map(tok => {
    const cmd = tok[0];
    const nums = (tok.slice(1).match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
    return { cmd, nums };
  });
}

/** Collect the anchor points the path passes through (M start + each L/Q end). */
function pathAnchors(d) {
  const pts = [];
  for (const { cmd, nums } of parsePath(d)) {
    if (cmd === 'M' || cmd === 'L') pts.push({ x: nums[0], y: nums[1] });
    else if (cmd === 'Q') pts.push({ x: nums[2], y: nums[3] });
  }
  return pts;
}

/** Quadratic control points (cx,cy) of every Q command. */
function quadControls(d) {
  return parsePath(d)
    .filter(c => c.cmd === 'Q')
    .map(c => ({ x: c.nums[0], y: c.nums[1] }));
}

/** Signed side of point p relative to directed line a→b (>0 left, <0 right). */
function sideOf(a, b, p) {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}

/** Sample a single quadratic Bézier at parameter t. */
function quadAt(p0, c, p1, t) {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x,
    y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y,
  };
}

// ─── curvedPath ─────────────────────────────────────────────────────────────────

test.describe('curvedPath', () => {
  test('two points → a straight segment', () => {
    const d = curvedPath([{ x: 0, y: 0 }, { x: 10, y: 0 }]);
    expect(d).toBe('M 0,0 L 10,0');
  });

  test('three points → a single quadratic with the waypoint as control', () => {
    const p0 = { x: 0, y: 0 }, p1 = { x: 5, y: 4 }, p2 = { x: 10, y: 0 };
    const d = curvedPath([p0, p1, p2]);
    const cmds = parsePath(d);
    // Exactly: M p0 ; Q p1 p2  — no trailing straight "L" half.
    expect(cmds.map(c => c.cmd)).toEqual(['M', 'Q']);
    const q = cmds[1];
    expect(q.nums).toEqual([5, 4, 10, 0]); // control = waypoint, ends on p2
  });

  test('curve bulges toward the waypoint (outward), not into the bend', () => {
    const p0 = { x: 0, y: 0 }, p1 = { x: 5, y: 4 }, p2 = { x: 10, y: 0 };
    const d = curvedPath([p0, p1, p2]);
    const ctrl = quadControls(d)[0];
    const apex = quadAt(p0, ctrl, p2, 0.5);
    // Apex and the waypoint must be on the SAME side of the chord p0→p2.
    const sApex = sideOf(p0, p2, apex);
    const sWaypoint = sideOf(p0, p2, p1);
    expect(Math.sign(sApex)).toBe(Math.sign(sWaypoint));
    // And it must actually bow out (not be ~collinear / straight).
    expect(Math.abs(apex.y)).toBeGreaterThan(1);
  });

  test('endpoints are preserved for a multi-point path', () => {
    const pts = [
      { x: 0, y: 0 }, { x: 4, y: 3 }, { x: 8, y: -2 }, { x: 12, y: 1 },
    ];
    const anchors = pathAnchors(curvedPath(pts));
    expect(anchors[0]).toEqual(pts[0]);                       // starts at P0
    expect(anchors[anchors.length - 1]).toEqual(pts[3]);      // ends at Pn
  });

  test('interior waypoints are used as control points', () => {
    const pts = [
      { x: 0, y: 0 }, { x: 4, y: 3 }, { x: 8, y: -2 }, { x: 12, y: 1 },
    ];
    const controls = quadControls(curvedPath(pts));
    expect(controls).toContainEqual({ x: 4, y: 3 });
    expect(controls).toContainEqual({ x: 8, y: -2 });
  });
});

// ─── dribblingPath ──────────────────────────────────────────────────────────────

test.describe('dribblingPath', () => {
  test('starts at the first point and ends near the last', () => {
    const pts = [{ x: 0, y: 0 }, { x: 20, y: 0 }];
    const anchors = pathAnchors(dribblingPath(pts, 1));
    expect(anchors[0]).toEqual({ x: 0, y: 0 });
    const end = anchors[anchors.length - 1];
    expect(end.x).toBeCloseTo(20, 5);
    expect(end.y).toBeCloseTo(0, 5);
  });

  test('consecutive waves alternate sides of a straight path', () => {
    const a = { x: 0, y: 0 }, b = { x: 30, y: 0 };
    const controls = quadControls(dribblingPath([a, b], 1));
    expect(controls.length).toBeGreaterThanOrEqual(2);
    // On a horizontal path the wave controls sit above/below the x-axis in turn.
    for (let i = 1; i < controls.length; i++) {
      expect(Math.sign(controls[i].y)).toBe(-Math.sign(controls[i - 1].y));
      expect(Math.abs(controls[i].y)).toBeGreaterThan(0.1);
    }
  });

  test('waves follow a bend: displacement is perpendicular to the local segment', () => {
    // L-shaped path: first leg goes +x, second leg goes +y.
    const a = { x: 0, y: 0 }, b = { x: 20, y: 0 }, c = { x: 20, y: 20 };
    const controls = quadControls(dribblingPath([a, b, c], 1));

    // Controls whose midpoint lies on the vertical second leg must be displaced
    // horizontally (perpendicular to +y). With the old bug they were displaced
    // vertically (using the first segment's perpendicular) — i.e. x≈20.
    const onSecondLeg = controls.filter(p => p.y > 1 && p.y < 19);
    expect(onSecondLeg.length).toBeGreaterThan(0);
    for (const p of onSecondLeg) {
      // Perpendicular to the vertical leg ⇒ noticeable x offset from the line x=20.
      expect(Math.abs(p.x - 20)).toBeGreaterThan(0.3);
    }
  });
});

// ─── straightPath (sanity) ──────────────────────────────────────────────────────

test('straightPath chains line segments through every point', () => {
  const d = straightPath([{ x: 0, y: 0 }, { x: 1, y: 2 }, { x: 3, y: 4 }]);
  expect(d).toBe('M 0,0 L 1,2 L 3,4');
});

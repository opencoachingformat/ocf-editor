/**
 * Renderer output tests (pure string generation — no browser).
 *
 * Guards the entity symbols, especially the FIBA defender, whose filled
 * self-intersecting Bézier previously collapsed into two stray crescents
 * instead of a horseshoe. The defender is now a single stroked arc.
 */

import { test, expect } from '@playwright/test';
import { renderOCF } from '../src/court/renderer.js';

function doc(entities, lines = []) {
  return {
    meta: { id: 't', title: 't' },
    court: { ruleset: 'fiba', type: 'half_court' },
    entities,
    frames: [{ id: 'f1', lines }],
  };
}

/** Pull every <path d="..."> from an SVG string. */
function paths(svg) {
  return [...svg.matchAll(/<path\b[^>]*\bd="([^"]*)"[^>]*>/g)].map(m => ({
    full: m[0],
    d: m[1],
  }));
}

test.describe('defense symbol', () => {
  const svg = renderOCF(doc([{ type: 'defense', nr: 5, x: 0, y: 7 }]), 0, 700, 760).svgContent;

  test('is drawn as a single open stroked arc, not a closed fill', () => {
    // Identify the defender path by its fill color (#58001d), which court lines
    // never use. It must be a stroked open arc — not the old self-closing blob.
    const defenderPaths = paths(svg).filter(p => p.full.includes('58001d'));
    expect(defenderPaths.length, 'expected one defender path').toBe(1);
    const arc = defenderPaths[0];
    expect(arc.d).toContain('A');               // elliptical arc
    expect(arc.d).not.toContain('Z');           // open at the bottom
    expect(arc.d).not.toContain('C');           // not the old cubic-bezier blob
    expect(arc.full).toContain('fill="none"');  // stroked, not filled
    expect(arc.full).toContain('stroke="#58001d"');
    expect(arc.full).toMatch(/stroke-width="[\d.]+"/);
  });

  test('shows the defender number', () => {
    expect(svg).toMatch(/>5<\/text>/);
  });

  test('does not draw the offense-style solid disc for a defender', () => {
    // Offense draws a filled colored circle of radius 12; defense must not.
    expect(svg).not.toMatch(/<circle[^>]*r="12"[^>]*fill="#58001d"/);
  });
});

test.describe('other entity symbols', () => {
  test('offense is a filled numbered circle', () => {
    const svg = renderOCF(doc([{ type: 'offense', nr: 7, x: 0, y: 7 }]), 0, 700, 760).svgContent;
    expect(svg).toMatch(/<circle[^>]*r="12"[^>]*fill="#003366"/);
    expect(svg).toMatch(/>7<\/text>/);
  });

  test('ball renders as a gradient ellipse', () => {
    const svg = renderOCF(doc([{ type: 'ball', x: 0, y: 7 }]), 0, 700, 760).svgContent;
    expect(svg).toMatch(/<ellipse[^>]*fill="url\(#ocf-ball-gradient\)"/);
  });

  test('coach renders as an outlined "C"', () => {
    const svg = renderOCF(doc([{ type: 'coach', x: 0, y: 7 }]), 0, 700, 760).svgContent;
    expect(svg).toMatch(/>C<\/text>/);
  });
});

test.describe('court + lines', () => {
  test('court surface and rim are present', () => {
    const svg = renderOCF(doc([]), 0, 700, 760).svgContent;
    expect(svg).toContain('fill="#d4a06a"');         // court surface
    expect(svg).toMatch(/stroke="#cc5500"/);          // rim
  });

  test('a movement line ends with an arrow marker', () => {
    const svg = renderOCF(
      doc([], [{ type: 'movement', coords: [{ x: -4, y: 6 }, { x: 4, y: 6 }] }]),
      0, 700, 760,
    ).svgContent;
    expect(svg).toContain('marker-end="url(#ocf-arrow)"');
  });

  test('a passing line is dashed', () => {
    const svg = renderOCF(
      doc([], [{ type: 'passing', coords: [{ x: -4, y: 6 }, { x: 4, y: 6 }] }]),
      0, 700, 760,
    ).svgContent;
    expect(svg).toMatch(/stroke-dasharray="6,4"/);
  });
});

/**
 * Court background SVG generation per ruleset.
 *
 * Coordinate system: origin = midcourt center, y+ = frontcourt (offense basket).
 * SVG y is flipped (y+ = down), handled by createTransform.
 *
 * FIBA half-court reference:
 *   - Court: 28m × 15m  → halfLength=14, halfWidth=7.5
 *   - Basket: 1.575m from baseline  → y = 14 - 1.575 = 12.425
 *   - Backboard: 1.20m from baseline → y = 14 - 1.20 = 12.80  (behind basket)
 *   - Paint: 4.9m wide, 5.8m deep (baseline to FT line) → FT line at y = 14 - 5.8 = 8.2
 *   - FT circle radius: 1.8m
 *   - Restricted arc: 1.25m radius centered on basket
 *   - 3pt arc: 6.75m radius, corner straight at x = ±6.60 (sideline - 0.9m)
 *   - Center circle: 1.8m radius at midcourt
 */

import { COURT_DIMENSIONS } from './positions.js';

const FIBA = {
  paintWidth:        4.9,     // total paint width
  paintDepth:        5.8,     // baseline → free throw line
  ftRadius:          1.8,     // free throw circle radius
  threePointDist:    6.75,    // 3pt arc radius from basket
  threePointCornerX: 6.6,     // x of corner 3pt straight line (halfWidth - 0.9)
  restrictedArcR:    1.25,    // no-charge arc radius
  centerCircleR:     1.8,
  basketFromBL:      1.575,   // basket center from baseline
  rimRadius:         0.225,
  backboardW:        1.8,
  backboardFromBL:   1.2,     // backboard distance from baseline (CLOSER than basket)
};

const NBA = {
  paintWidth:        4.88,    // 16ft
  paintDepth:        5.79,    // 19ft
  ftRadius:          1.83,    // 6ft
  threePointDist:    7.24,    // 23.75ft
  threePointCornerX: 6.71,    // 22ft from center = 25-3=22ft → 6.71m
  restrictedArcR:    1.22,    // 4ft
  centerCircleR:     1.83,    // 6ft
  basketFromBL:      1.60,    // 5.25ft
  rimRadius:         0.23,
  backboardW:        1.83,    // 6ft
  backboardFromBL:   1.22,    // 4ft
};

const NCAA = {
  paintWidth:        3.66,    // 12ft
  paintDepth:        5.79,
  ftRadius:          1.83,
  threePointDist:    6.75,    // 22.146ft ≈ 6.75m
  threePointCornerX: 6.40,
  restrictedArcR:    1.22,
  centerCircleR:     1.83,
  basketFromBL:      1.60,
  rimRadius:         0.23,
  backboardW:        1.83,
  backboardFromBL:   1.22,
};

const NFHS = {
  paintWidth:        3.66,
  paintDepth:        5.79,
  ftRadius:          1.83,
  threePointDist:    6.02,    // 19.75ft
  threePointCornerX: 6.10,
  restrictedArcR:    0,       // no restricted arc in NFHS
  centerCircleR:     1.83,
  basketFromBL:      1.60,
  rimRadius:         0.23,
  backboardW:        1.83,
  backboardFromBL:   1.22,
};

const COURT_DETAILS = { fiba: FIBA, nba: NBA, ncaa: NCAA, nfhs: NFHS };

/**
 * Create a coordinate transform: court coords → SVG pixel coords.
 */
export function createTransform(ruleset, courtType, svgWidth, svgHeight) {
  const dims = COURT_DIMENSIONS[ruleset];
  if (!dims) throw new Error(`Unknown ruleset: ${ruleset}`);

  const hw = dims.halfWidth;
  const hl = dims.halfLength;

  let xMin, xMax, yMin, yMax;
  if (courtType === 'full_court') {
    xMin = -hw; xMax = hw;
    yMin = -hl; yMax = hl;
  } else {
    xMin = -hw; xMax = hw;
    yMin = 0;   yMax = hl;
  }

  const courtW = xMax - xMin;
  const courtH = yMax - yMin;
  const paddingM = dims.unit === 'm' ? 0.5 : 1.5;

  const totalW = courtW + paddingM * 2;
  const totalH = courtH + paddingM * 2;

  const scaleX = svgWidth / totalW;
  const scaleY = svgHeight / totalH;
  const scale = Math.min(scaleX, scaleY);

  const offsetX = (svgWidth  - courtW * scale) / 2;
  const offsetY = (svgHeight - courtH * scale) / 2;

  return {
    toSvg(cx, cy) {
      const sx = (cx - xMin) * scale + offsetX;
      const sy = (yMax - cy) * scale + offsetY; // y flipped
      return { x: sx, y: sy };
    },
    toCourt(sx, sy) {
      const cx = (sx - offsetX) / scale + xMin;
      const cy = yMax - (sy - offsetY) / scale;
      return { x: cx, y: cy };
    },
    s(d) { return d * scale; },
    scale,
    xMin, xMax, yMin, yMax,
    courtW, courtH,
  };
}

/**
 * Generate court background SVG elements string.
 */
export function renderCourtSVG(ruleset, courtType, transform) {
  const details = COURT_DETAILS[ruleset] || FIBA;
  const dims    = COURT_DIMENSIONS[ruleset];
  const t       = transform;
  const hw      = dims.halfWidth;
  const hl      = dims.halfLength;

  const LC  = '#7a5c3a';   // line color
  const LW  = 1.8;         // line width
  const paintFill = 'rgba(180,160,120,0.18)';

  let svg = '';

  // ── Court surface ──────────────────────────────────────────────────────────
  {
    const tl = t.toSvg(-hw, courtType === 'full_court' ? hl :  hl);
    const br = t.toSvg( hw, courtType === 'full_court' ? -hl : 0);
    svg += `<rect x="${f(tl.x)}" y="${f(tl.y)}" width="${f(br.x-tl.x)}" height="${f(br.y-tl.y)}" fill="#d4a06a" stroke="${LC}" stroke-width="2.5"/>`;
  }

  // ── Sidelines + boundary (already covered by rect, add inner boundary) ─────
  // (the rect above IS the boundary — no extra sidelines needed)

  // ── Half-court elements ────────────────────────────────────────────────────
  svg += drawHalfCourt(t, details, hw, hl, LC, LW, paintFill, false);

  if (courtType === 'full_court') {
    svg += drawHalfCourt(t, details, hw, hl, LC, LW, paintFill, true);

    // Midline
    const ml = t.toSvg(-hw, 0);
    const mr = t.toSvg( hw, 0);
    svg += line(ml, mr, LC, LW);

    // Center circle (full)
    const cc  = t.toSvg(0, 0);
    const ccr = t.s(details.centerCircleR);
    svg += `<circle cx="${f(cc.x)}" cy="${f(cc.y)}" r="${f(ccr)}" fill="none" stroke="${LC}" stroke-width="${LW}"/>`;
  } else {
    // Half-court: center circle shows only the half facing the court (y > 0 side)
    // In SVG that's the arc going upward from (-ccr,0) to (+ccr,0)
    const cc  = t.toSvg(0, 0);
    const ccr = t.s(details.centerCircleR);
    // Arc from left to right, the upper half in SVG (which is toward midcourt)
    const arcL = t.toSvg(-details.centerCircleR, 0);
    const arcR = t.toSvg( details.centerCircleR, 0);
    // sweep-flag=0: counter-clockwise → goes upward in SVG (away from court)
    svg += `<path d="M ${f(arcL.x)},${f(arcL.y)} A ${f(ccr)},${f(ccr)} 0 0,0 ${f(arcR.x)},${f(arcR.y)}" fill="none" stroke="${LC}" stroke-width="${LW}"/>`;

    // Midline (just the baseline of the half-court view = the midcourt line)
    const ml = t.toSvg(-hw, 0);
    const mr = t.toSvg( hw, 0);
    svg += line(ml, mr, LC, LW);

    // Center dot
    svg += `<circle cx="${f(cc.x)}" cy="${f(cc.y)}" r="3" fill="${LC}"/>`;
  }

  return svg;
}

// ─── Half-court drawing ───────────────────────────────────────────────────────

function drawHalfCourt(t, d, hw, hl, LC, LW, paintFill, mirror) {
  const sign      = mirror ? -1 : 1;
  const baseY     = hl  * sign;                        // baseline y
  const basketY   = (hl - d.basketFromBL)  * sign;     // basket center y
  const ftLineY   = (hl - d.paintDepth)    * sign;     // free throw line y
  const boardY    = (hl - d.backboardFromBL) * sign;   // backboard y (closer to baseline than basket)
  const paintHW   = d.paintWidth / 2;

  let svg = '';

  // Paint fill + outline
  {
    const tl = t.toSvg(-paintHW, baseY);
    const br = t.toSvg( paintHW, ftLineY);
    const x  = Math.min(tl.x, br.x);
    const y  = Math.min(tl.y, br.y);
    const w  = Math.abs(br.x - tl.x);
    const h  = Math.abs(br.y - tl.y);
    svg += `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${paintFill}" stroke="${LC}" stroke-width="${LW}"/>`;
  }

  // Free throw line (top of paint)
  {
    const fl = t.toSvg(-paintHW, ftLineY);
    const fr = t.toSvg( paintHW, ftLineY);
    svg += line(fl, fr, LC, LW);
  }

  // Free throw circle:
  //   - solid half facing the basket (away from midcourt in SVG)
  //   - dashed half facing midcourt
  {
    const ftc = t.toSvg(0, ftLineY);
    const ftr = t.s(d.ftRadius);
    const ftL = t.toSvg(-d.ftRadius, ftLineY);
    const ftR = t.toSvg( d.ftRadius, ftLineY);

    if (mirror) {
      // Backcourt: solid half faces upward in SVG (toward midcourt), dashed faces down (baseline)
      svg += `<path d="M ${f(ftL.x)},${f(ftL.y)} A ${f(ftr)},${f(ftr)} 0 0,0 ${f(ftR.x)},${f(ftR.y)}" fill="none" stroke="${LC}" stroke-width="${LW}"/>`;
      svg += `<path d="M ${f(ftL.x)},${f(ftL.y)} A ${f(ftr)},${f(ftr)} 0 0,1 ${f(ftR.x)},${f(ftR.y)}" fill="none" stroke="${LC}" stroke-width="${LW}" stroke-dasharray="5,4"/>`;
    } else {
      // Frontcourt: solid half faces downward in SVG (toward baseline), dashed faces up (midcourt)
      svg += `<path d="M ${f(ftL.x)},${f(ftL.y)} A ${f(ftr)},${f(ftr)} 0 0,1 ${f(ftR.x)},${f(ftR.y)}" fill="none" stroke="${LC}" stroke-width="${LW}"/>`;
      svg += `<path d="M ${f(ftL.x)},${f(ftL.y)} A ${f(ftr)},${f(ftr)} 0 0,0 ${f(ftR.x)},${f(ftR.y)}" fill="none" stroke="${LC}" stroke-width="${LW}" stroke-dasharray="5,4"/>`;
    }
  }

  // Three-point line
  svg += drawThreePoint(t, d, hw, hl, baseY, basketY, LC, LW, mirror);

  // Restricted area arc (no-charge zone), semicircle facing midcourt
  if (d.restrictedArcR > 0) {
    const rr  = t.s(d.restrictedArcR);
    const raL = t.toSvg(-d.restrictedArcR, basketY);
    const raR = t.toSvg( d.restrictedArcR, basketY);
    // Arc opens toward midcourt: sweep=0 for frontcourt (upward in SVG), sweep=1 for backcourt
    const sw  = mirror ? 1 : 0;
    svg += `<path d="M ${f(raL.x)},${f(raL.y)} A ${f(rr)},${f(rr)} 0 0,${sw} ${f(raR.x)},${f(raR.y)}" fill="none" stroke="${LC}" stroke-width="${LW}"/>`;
  }

  // Backboard — a thick line at boardY, spans backboardW
  {
    const bbl = t.toSvg(-d.backboardW / 2, boardY);
    const bbr = t.toSvg( d.backboardW / 2, boardY);
    svg += line(bbl, bbr, LC, 3.5);
  }

  // Basket rim — circle at basketY, between backboard and midcourt
  {
    const bk  = t.toSvg(0, basketY);
    const rr  = t.s(d.rimRadius);
    svg += `<circle cx="${f(bk.x)}" cy="${f(bk.y)}" r="${f(rr)}" fill="none" stroke="#cc5500" stroke-width="2.2"/>`;
  }

  // Basket support line: backboard center to rim center
  {
    const bbl_c = t.toSvg(0, boardY);
    const bk_c  = t.toSvg(0, basketY);
    svg += line(bbl_c, bk_c, LC, 1.2);
  }

  return svg;
}

// ─── Three-point line ─────────────────────────────────────────────────────────

function drawThreePoint(t, d, hw, hl, baseY, basketY, LC, LW, mirror) {
  const sign    = mirror ? -1 : 1;
  const cornerX = d.threePointCornerX;   // x of the straight corner lines
  const arcR    = t.s(d.threePointDist); // SVG radius

  // Where does the arc (centered at basket) at x=cornerX intersect?
  // arcY_court = basketY_abs ± sqrt(R² - cornerX²),  take the side toward midcourt
  const basketYabs = (hl - d.basketFromBL);
  const innerSq    = d.threePointDist * d.threePointDist - cornerX * cornerX;
  const arcOffsetY = innerSq > 0 ? Math.sqrt(innerSq) : 0;

  // The arc–corner junction in court coords
  const junctionY  = (basketYabs - arcOffsetY) * sign;   // toward midcourt from basket

  // Corner straight lines: baseline → junction
  const lcB = t.toSvg(-cornerX, baseY);
  const lcJ = t.toSvg(-cornerX, junctionY);
  const rcB = t.toSvg( cornerX, baseY);
  const rcJ = t.toSvg( cornerX, junctionY);

  let svg = '';
  svg += line(lcB, lcJ, LC, LW);
  svg += line(rcB, rcJ, LC, LW);

  // Arc: left junction → right junction, sweeps away from baseline
  // Frontcourt (mirror=false): arc bulges toward midcourt (upward in SVG) → sweep=0
  // Backcourt  (mirror=true):  arc bulges toward midcourt (downward in SVG) → sweep=1
  const sw = mirror ? 1 : 0;
  svg += `<path d="M ${f(lcJ.x)},${f(lcJ.y)} A ${f(arcR)},${f(arcR)} 0 0,${sw} ${f(rcJ.x)},${f(rcJ.y)}" fill="none" stroke="${LC}" stroke-width="${LW}"/>`;

  return svg;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function line(a, b, color, width) {
  return `<line x1="${f(a.x)}" y1="${f(a.y)}" x2="${f(b.x)}" y2="${f(b.y)}" stroke="${color}" stroke-width="${width}"/>`;
}

/** Round to 2 decimal places for clean SVG output */
function f(n) { return Math.round(n * 100) / 100; }

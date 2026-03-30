/**
 * Court background SVG generation per ruleset.
 *
 * Coordinate system: origin = midcourt center, y+ = frontcourt (offense basket).
 * SVG y is flipped (y+ = down), handled by createTransform.
 *
 * All dimensions verified against official rulebooks:
 *   FIBA:  2023 Official Basketball Rules
 *   NBA:   2023-24 Official Rules
 *   NCAA:  2023-24 Rules (post-2019 3pt line)
 *   NFHS:  2023-24 Rules
 *
 * Units: FIBA stores court coords in meters, NBA/NCAA/NFHS in feet.
 * COURT_DIMENSIONS in positions.js reflects this.
 *
 * Half-court view: y goes from 0 (midcourt) to halfLength (offense baseline).
 * Basket is at y = halfLength - basketFromBL.
 */

import { COURT_DIMENSIONS } from './positions.js';

// All values in the same unit as the ruleset (FIBA=m, others=ft)
const FIBA = {
  paintWidth:          4.900,   // total paint (lane) width
  paintDepth:          5.800,   // baseline → free throw line
  ftRadius:            1.800,   // free throw circle radius
  threePointDist:      6.750,   // 3pt arc radius from basket center
  threePointCornerX:   6.600,   // x of corner straight (halfWidth - 0.9)
  threePointCornerY:   null,    // computed: straight ends at arc junction
  restrictedArcR:      1.250,   // no-charge arc radius
  centerCircleR:       1.800,
  basketFromBL:        1.575,   // basket center from baseline
  rimRadius:           0.225,   // inner rim radius
  backboardW:          1.830,   // backboard width
  backboardFromBL:     1.200,   // backboard distance from baseline
};

// NBA — all in feet
const NBA = {
  paintWidth:          16.000,  // 16ft
  paintDepth:          19.000,  // 19ft (baseline → FT line)
  ftRadius:             6.000,  // 6ft
  threePointDist:      23.750,  // 23'9"
  threePointCornerX:   22.000,  // 22ft from basket center (x of corner straight)
  threePointCornerEnd:  14.000, // corner straight extends to 14ft from baseline
  restrictedArcR:       4.000,  // 4ft
  centerCircleR:        6.000,
  basketFromBL:         5.250,  // 5'3"
  rimRadius:            0.750,  // ~9" inner radius
  backboardW:           6.000,  // 6ft
  backboardFromBL:      4.000,  // 4ft
};

// NCAA — all in feet. Post-2019 3pt line.
const NCAA = {
  paintWidth:          12.000,  // 12ft (narrower than NBA)
  paintDepth:          19.000,
  ftRadius:             6.000,
  threePointDist:      22.146,  // 22'1.75" — full arc, no corner straights
  threePointCornerX:   null,    // continuous arc from baseline (no straights)
  restrictedArcR:       4.000,
  centerCircleR:        6.000,
  basketFromBL:         5.250,
  rimRadius:            0.750,
  backboardW:           6.000,
  backboardFromBL:      4.000,
};

// NFHS — all in feet. No restricted arc. Full 3pt arc (no corner straights).
const NFHS = {
  paintWidth:          12.000,  // 12ft
  paintDepth:          19.000,
  ftRadius:             6.000,
  threePointDist:      19.750,  // 19'9" — full arc, no corner straights
  threePointCornerX:   null,    // no corner straights
  restrictedArcR:       0,      // no restricted arc
  centerCircleR:        6.000,
  basketFromBL:         5.250,
  rimRadius:            0.750,
  backboardW:           6.000,
  backboardFromBL:      4.000,
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
  // Padding in court units (small visual margin outside boundary)
  const pad = dims.unit === 'm' ? 0.4 : 1.3;

  const totalW = courtW + pad * 2;
  const totalH = courtH + pad * 2;

  const scale = Math.min(svgWidth / totalW, svgHeight / totalH);

  const offsetX = (svgWidth  - courtW * scale) / 2;
  const offsetY = (svgHeight - courtH * scale) / 2;

  return {
    toSvg(cx, cy) {
      return {
        x: (cx - xMin) * scale + offsetX,
        y: (yMax - cy)  * scale + offsetY,  // y flipped
      };
    },
    toCourt(sx, sy) {
      return {
        x: (sx - offsetX) / scale + xMin,
        y: yMax - (sy - offsetY) / scale,
      };
    },
    s(d)  { return d * scale; },
    scale,
    xMin, xMax, yMin, yMax,
    courtW, courtH,
  };
}

/**
 * Generate court background SVG elements string.
 */
export function renderCourtSVG(ruleset, courtType, transform) {
  const d  = COURT_DETAILS[ruleset] || FIBA;
  const dims = COURT_DIMENSIONS[ruleset];
  const t  = transform;
  const hw = dims.halfWidth;
  const hl = dims.halfLength;

  const LC = '#7a5c3a';  // line color
  const LW = 1.8;        // line width (px)
  const paintFill = 'rgba(180,160,120,0.18)';

  let svg = '';

  // ── Court surface background ───────────────────────────────────────────────
  {
    const tl = t.toSvg(-hw,  hl);
    const br = t.toSvg( hw, courtType === 'full_court' ? -hl : 0);
    svg += `<rect x="${f(tl.x)}" y="${f(tl.y)}" width="${f(br.x - tl.x)}" height="${f(br.y - tl.y)}" fill="#d4a06a" stroke="${LC}" stroke-width="2.5"/>`;
  }

  // ── Frontcourt (offense basket side) ──────────────────────────────────────
  svg += drawHalfCourt(t, d, hw, hl, LC, LW, paintFill, false);

  if (courtType === 'full_court') {
    // ── Backcourt (mirrored) ──────────────────────────────────────────────
    svg += drawHalfCourt(t, d, hw, hl, LC, LW, paintFill, true);

    // Midline
    svg += line(t.toSvg(-hw, 0), t.toSvg(hw, 0), LC, LW);

    // Center circle (full)
    const cc  = t.toSvg(0, 0);
    const ccr = t.s(d.centerCircleR);
    svg += `<circle cx="${f(cc.x)}" cy="${f(cc.y)}" r="${f(ccr)}" fill="none" stroke="${LC}" stroke-width="${LW}"/>`;
    svg += `<circle cx="${f(cc.x)}" cy="${f(cc.y)}" r="3" fill="${LC}"/>`;
  } else {
    // Half-court: midline + center circle half (only the half outside the court)
    svg += line(t.toSvg(-hw, 0), t.toSvg(hw, 0), LC, LW);

    const cc  = t.toSvg(0, 0);
    const ccr = t.s(d.centerCircleR);
    // Arc from left to right, sweeping AWAY from court (upward in SVG = sweep=0)
    const L = t.toSvg(-d.centerCircleR, 0);
    const R = t.toSvg( d.centerCircleR, 0);
    svg += `<path d="M ${f(L.x)},${f(L.y)} A ${f(ccr)},${f(ccr)} 0 0,0 ${f(R.x)},${f(R.y)}" fill="none" stroke="${LC}" stroke-width="${LW}"/>`;
    svg += `<circle cx="${f(cc.x)}" cy="${f(cc.y)}" r="3" fill="${LC}"/>`;
  }

  return svg;
}

// ─── Half-court drawing ───────────────────────────────────────────────────────

function drawHalfCourt(t, d, hw, hl, LC, LW, paintFill, mirror) {
  const sign    = mirror ? -1 : 1;
  const baseY   = hl * sign;                         // baseline y
  const basketY = (hl - d.basketFromBL) * sign;      // basket center y
  const ftLineY = (hl - d.paintDepth)   * sign;      // free throw line y
  const boardY  = (hl - d.backboardFromBL) * sign;   // backboard y
  const paintHW = d.paintWidth / 2;

  let svg = '';

  // ── Paint (filled rect + outline) ────────────────────────────────────────
  {
    const tl = t.toSvg(-paintHW, baseY);
    const br = t.toSvg( paintHW, ftLineY);
    svg += `<rect x="${f(Math.min(tl.x, br.x))}" y="${f(Math.min(tl.y, br.y))}" width="${f(Math.abs(br.x - tl.x))}" height="${f(Math.abs(br.y - tl.y))}" fill="${paintFill}" stroke="${LC}" stroke-width="${LW}"/>`;
  }

  // Free throw line (top of paint rect already draws it, but add explicitly for clarity)
  // Already part of paint rect stroke. Add FT line separately for correct z-order.
  {
    const fl = t.toSvg(-paintHW, ftLineY);
    const fr = t.toSvg( paintHW, ftLineY);
    svg += line(fl, fr, LC, LW);
  }

  // ── Free throw circle ─────────────────────────────────────────────────────
  // Solid half toward baseline, dashed half toward midcourt
  {
    const ftr = t.s(d.ftRadius);
    const ftL = t.toSvg(-d.ftRadius, ftLineY);
    const ftR = t.toSvg( d.ftRadius, ftLineY);

    if (mirror) {
      // Backcourt: solid half faces upward in SVG (toward midcourt), sweep=0 solid
      svg += `<path d="M ${f(ftL.x)},${f(ftL.y)} A ${f(ftr)},${f(ftr)} 0 0,0 ${f(ftR.x)},${f(ftR.y)}" fill="none" stroke="${LC}" stroke-width="${LW}"/>`;
      svg += `<path d="M ${f(ftL.x)},${f(ftL.y)} A ${f(ftr)},${f(ftr)} 0 0,1 ${f(ftR.x)},${f(ftR.y)}" fill="none" stroke="${LC}" stroke-width="${LW}" stroke-dasharray="5,4"/>`;
    } else {
      // Frontcourt: solid half faces downward in SVG (toward baseline), sweep=1 solid
      svg += `<path d="M ${f(ftL.x)},${f(ftL.y)} A ${f(ftr)},${f(ftr)} 0 0,1 ${f(ftR.x)},${f(ftR.y)}" fill="none" stroke="${LC}" stroke-width="${LW}"/>`;
      svg += `<path d="M ${f(ftL.x)},${f(ftL.y)} A ${f(ftr)},${f(ftr)} 0 0,0 ${f(ftR.x)},${f(ftR.y)}" fill="none" stroke="${LC}" stroke-width="${LW}" stroke-dasharray="5,4"/>`;
    }
  }

  // ── Three-point line ──────────────────────────────────────────────────────
  svg += drawThreePoint(t, d, hw, hl, baseY, basketY, LC, LW, mirror);

  // ── Restricted area arc (no-charge zone) ─────────────────────────────────
  if (d.restrictedArcR > 0) {
    const rr  = t.s(d.restrictedArcR);
    const raL = t.toSvg(-d.restrictedArcR, basketY);
    const raR = t.toSvg( d.restrictedArcR, basketY);
    // Opens toward midcourt: sweep=0 for frontcourt, sweep=1 for backcourt
    const sw = mirror ? 1 : 0;
    svg += `<path d="M ${f(raL.x)},${f(raL.y)} A ${f(rr)},${f(rr)} 0 0,${sw} ${f(raR.x)},${f(raR.y)}" fill="none" stroke="${LC}" stroke-width="${LW}"/>`;
  }

  // ── Backboard ─────────────────────────────────────────────────────────────
  {
    const bbl = t.toSvg(-d.backboardW / 2, boardY);
    const bbr = t.toSvg( d.backboardW / 2, boardY);
    svg += line(bbl, bbr, LC, 3.5);
  }

  // ── Basket support line (backboard → rim center) ─────────────────────────
  {
    svg += line(t.toSvg(0, boardY), t.toSvg(0, basketY), LC, 1.2);
  }

  // ── Rim ───────────────────────────────────────────────────────────────────
  {
    const bk  = t.toSvg(0, basketY);
    const rr  = t.s(d.rimRadius);
    svg += `<circle cx="${f(bk.x)}" cy="${f(bk.y)}" r="${f(rr)}" fill="none" stroke="#cc5500" stroke-width="2.2"/>`;
  }

  return svg;
}

// ─── Three-point line ─────────────────────────────────────────────────────────

function drawThreePoint(t, d, hw, hl, baseY, basketY, LC, LW, mirror) {
  const sign   = mirror ? -1 : 1;
  const arcR   = t.s(d.threePointDist);
  const basketYabs = hl - d.basketFromBL;  // basket distance from midcourt (absolute)

  let svg = '';

  if (d.threePointCornerX !== null) {
    // ── NBA / FIBA style: corner straights + arc ──────────────────────────
    const cornerX = d.threePointCornerX;

    let junctionY;  // y coord of arc-corner junction

    if (d.threePointCornerEnd !== undefined) {
      // NBA: corner straight goes to explicit depth from baseline
      junctionY = (hl - d.threePointCornerEnd) * sign;
    } else {
      // FIBA: compute arc junction
      const inner = d.threePointDist * d.threePointDist - cornerX * cornerX;
      const dy    = inner > 0 ? Math.sqrt(inner) : 0;
      junctionY   = (basketYabs - dy) * sign;
    }

    // Corner straights: baseline → junction
    svg += line(t.toSvg(-cornerX, baseY), t.toSvg(-cornerX, junctionY), LC, LW);
    svg += line(t.toSvg( cornerX, baseY), t.toSvg( cornerX, junctionY), LC, LW);

    // Arc from left junction to right junction
    const jL = t.toSvg(-cornerX, junctionY);
    const jR = t.toSvg( cornerX, junctionY);
    // Arc sweeps away from baseline: sweep=0 for frontcourt, sweep=1 for backcourt
    const sw = mirror ? 1 : 0;
    svg += `<path d="M ${f(jL.x)},${f(jL.y)} A ${f(arcR)},${f(arcR)} 0 0,${sw} ${f(jR.x)},${f(jR.y)}" fill="none" stroke="${LC}" stroke-width="${LW}"/>`;

  } else {
    // ── NCAA / NFHS style: continuous arc from baseline to baseline ───────
    // Arc centered at basket, intersects baseline at x = ±sqrt(R²-basketFromBL²)
    const R = d.threePointDist;
    const yOffsetFromBasket = d.basketFromBL;  // distance basket is from baseline
    const inner = R * R - yOffsetFromBasket * yOffsetFromBasket;
    const xAtBaseline = inner > 0 ? Math.sqrt(inner) : R;

    const arcL = t.toSvg(-xAtBaseline, baseY);
    const arcR_pt = t.toSvg( xAtBaseline, baseY);

    // Arc: from left baseline point to right baseline point, sweeping toward midcourt
    // sweep=0 for frontcourt (arc bulges away from baseline = upward in SVG)
    // sweep=1 for backcourt
    const sw = mirror ? 1 : 0;
    svg += `<path d="M ${f(arcL.x)},${f(arcL.y)} A ${f(arcR)},${f(arcR)} 0 0,${sw} ${f(arcR_pt.x)},${f(arcR_pt.y)}" fill="none" stroke="${LC}" stroke-width="${LW}"/>`;
  }

  return svg;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function line(a, b, color, width) {
  return `<line x1="${f(a.x)}" y1="${f(a.y)}" x2="${f(b.x)}" y2="${f(b.y)}" stroke="${color}" stroke-width="${width}"/>`;
}

function f(n) { return Math.round(n * 100) / 100; }

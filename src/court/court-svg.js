/**
 * Court background SVG generation per ruleset.
 * Generates the court lines, paint, arcs, baskets, etc.
 */

import { COURT_DIMENSIONS } from './positions.js';

/**
 * FIBA court dimensions for drawing.
 */
const FIBA = {
  paintWidth: 4.9,       // 4.9m total width (2.45 each side)
  paintDepth: 5.8,       // from baseline to free throw line
  ftRadius: 1.8,         // free throw circle radius
  threePointDist: 6.75,  // 3pt arc radius
  threePointCorner: 0.9, // 3pt line from sideline in corner
  restrictedArcR: 1.25,  // restricted area arc radius
  centerCircleR: 1.8,    // center circle radius
  basketFromBL: 1.575,   // basket center from baseline
  rimRadius: 0.225,      // rim inner radius
  backboardW: 1.8,       // backboard width
  backboardOffset: 1.2,  // backboard distance from baseline
};

const NBA = {
  paintWidth: 16,
  paintDepth: 19,
  ftRadius: 6,
  threePointDist: 23.75,
  threePointCorner: 3,
  restrictedArcR: 4,
  centerCircleR: 6,
  basketFromBL: 5.25,
  rimRadius: 0.75,
  backboardW: 6,
  backboardOffset: 4,
};

const NCAA = {
  paintWidth: 12,
  paintDepth: 19,
  ftRadius: 6,
  threePointDist: 22.146,
  threePointCorner: 3.34,
  restrictedArcR: 4,
  centerCircleR: 6,
  basketFromBL: 5.25,
  rimRadius: 0.75,
  backboardW: 6,
  backboardOffset: 4,
};

const NFHS = {
  paintWidth: 12,
  paintDepth: 19,
  ftRadius: 6,
  threePointDist: 19.75,
  threePointCorner: 5.25,
  restrictedArcR: 0,
  centerCircleR: 6,
  basketFromBL: 5.25,
  rimRadius: 0.75,
  backboardW: 6,
  backboardOffset: 4,
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
    // half_court: y from 0 (midline) to halfLength (offense baseline)
    xMin = -hw; xMax = hw;
    yMin = 0; yMax = hl;
  }

  const courtW = xMax - xMin;
  const courtH = yMax - yMin;
  const padding = 0.5 * (dims.unit === 'm' ? 1 : 3.28);

  // Add padding
  const totalW = courtW + padding * 2;
  const totalH = courtH + padding * 2;

  const scaleX = svgWidth / totalW;
  const scaleY = svgHeight / totalH;
  const scale = Math.min(scaleX, scaleY);

  const offsetX = (svgWidth - courtW * scale) / 2;
  const offsetY = (svgHeight - courtH * scale) / 2;

  return {
    // Court coord → SVG pixel
    toSvg(cx, cy) {
      const sx = (cx - xMin) * scale + offsetX;
      const sy = (yMax - cy) * scale + offsetY; // y is flipped
      return { x: sx, y: sy };
    },
    // SVG pixel → Court coord
    toCourt(sx, sy) {
      const cx = (sx - offsetX) / scale + xMin;
      const cy = yMax - (sy - offsetY) / scale;
      return { x: cx, y: cy };
    },
    // Scale distance (court units → SVG pixels)
    s(d) { return d * scale; },
    scale,
    xMin, xMax, yMin, yMax,
    courtW, courtH,
  };
}

/**
 * Generate court background SVG elements (as SVG string).
 */
export function renderCourtSVG(ruleset, courtType, transform) {
  const details = COURT_DETAILS[ruleset] || FIBA;
  const dims = COURT_DIMENSIONS[ruleset];
  const t = transform;
  const hw = dims.halfWidth;
  const hl = dims.halfLength;

  const lineColor = '#555555';
  const lineW = 1.5;
  const paintColor = 'rgba(200,200,200,0.15)';
  const courtColor = '#f5e6c8';
  const courtBorder = '#333333';

  let svg = '';

  // Court background
  const tlCourt = t.toSvg(-hw, courtType === 'full_court' ? hl : hl);
  const brCourt = t.toSvg(hw, courtType === 'full_court' ? -hl : 0);
  svg += `<rect x="${tlCourt.x}" y="${tlCourt.y}" width="${brCourt.x - tlCourt.x}" height="${brCourt.y - tlCourt.y}" fill="${courtColor}" stroke="${courtBorder}" stroke-width="2"/>`;

  // Helper: draw half-court elements (frontcourt)
  svg += drawHalfCourt(t, details, dims, hw, hl, lineColor, lineW, paintColor, false);

  if (courtType === 'full_court') {
    // Backcourt (mirrored)
    svg += drawHalfCourt(t, details, dims, hw, hl, lineColor, lineW, paintColor, true);
  }

  // Midline
  if (courtType === 'full_court') {
    const ml = t.toSvg(-hw, 0);
    const mr = t.toSvg(hw, 0);
    svg += `<line x1="${ml.x}" y1="${ml.y}" x2="${mr.x}" y2="${mr.y}" stroke="${lineColor}" stroke-width="${lineW}"/>`;
  }

  // Center circle
  const cc = t.toSvg(0, 0);
  const ccr = t.s(details.centerCircleR);
  svg += `<circle cx="${cc.x}" cy="${cc.y}" r="${ccr}" fill="none" stroke="${lineColor}" stroke-width="${lineW}"/>`;

  // Center dot
  svg += `<circle cx="${cc.x}" cy="${cc.y}" r="3" fill="${lineColor}"/>`;

  return svg;
}

function drawHalfCourt(t, details, dims, hw, hl, lineColor, lineW, paintColor, mirror) {
  const sign = mirror ? -1 : 1;
  const baselineY = hl * sign;
  const basketY = (hl - details.basketFromBL) * sign;
  const ftLineY = (hl - details.paintDepth) * sign;
  const paintHW = details.paintWidth / 2;

  let svg = '';

  // Baseline
  const bl = t.toSvg(-hw, baselineY);
  const br = t.toSvg(hw, baselineY);
  svg += `<line x1="${bl.x}" y1="${bl.y}" x2="${br.x}" y2="${br.y}" stroke="${lineColor}" stroke-width="${lineW}"/>`;

  // Paint (filled rectangle)
  const ptl = t.toSvg(-paintHW, baselineY);
  const pbr = t.toSvg(paintHW, ftLineY);
  const pw = Math.abs(pbr.x - ptl.x);
  const ph = Math.abs(pbr.y - ptl.y);
  svg += `<rect x="${Math.min(ptl.x, pbr.x)}" y="${Math.min(ptl.y, pbr.y)}" width="${pw}" height="${ph}" fill="${paintColor}" stroke="${lineColor}" stroke-width="${lineW}"/>`;

  // Free throw circle (only top half for half-court view)
  const ftc = t.toSvg(0, ftLineY);
  const ftr = t.s(details.ftRadius);
  svg += `<circle cx="${ftc.x}" cy="${ftc.y}" r="${ftr}" fill="none" stroke="${lineColor}" stroke-width="${lineW}" stroke-dasharray="4,4"/>`;

  // Three-point line
  svg += drawThreePointLine(t, details, hw, hl, baselineY, basketY, lineColor, lineW, mirror);

  // Restricted area arc (if exists)
  if (details.restrictedArcR > 0) {
    const basketSvg = t.toSvg(0, basketY);
    const rr = t.s(details.restrictedArcR);
    const sweepFlag = mirror ? 0 : 1;
    const arcStart = t.toSvg(-details.restrictedArcR, basketY);
    const arcEnd = t.toSvg(details.restrictedArcR, basketY);
    // Draw arc from one side to the other
    svg += `<path d="M ${arcStart.x},${arcStart.y} A ${rr},${rr} 0 0,${sweepFlag} ${arcEnd.x},${arcEnd.y}" fill="none" stroke="${lineColor}" stroke-width="${lineW}" stroke-dasharray="3,3"/>`;
  }

  // Basket (rim + backboard)
  const basketSvg = t.toSvg(0, basketY);
  const rimR = t.s(details.rimRadius);
  svg += `<circle cx="${basketSvg.x}" cy="${basketSvg.y}" r="${rimR}" fill="none" stroke="#ff6600" stroke-width="2"/>`;

  // Backboard
  const bbHW = details.backboardW / 2;
  const bbY = (hl - details.backboardOffset) * sign;
  const bbl = t.toSvg(-bbHW, bbY);
  const bbr = t.toSvg(bbHW, bbY);
  svg += `<line x1="${bbl.x}" y1="${bbl.y}" x2="${bbr.x}" y2="${bbr.y}" stroke="${lineColor}" stroke-width="2.5"/>`;

  return svg;
}

function drawThreePointLine(t, details, hw, hl, baselineY, basketY, lineColor, lineW, mirror) {
  const sign = mirror ? -1 : 1;
  const threeR = details.threePointDist;
  const cornerDist = details.threePointCorner;

  // Three-point arc
  const basketSvg = t.toSvg(0, basketY);
  const arcR = t.s(threeR);

  // Corner lines: straight parts along sideline
  const cornerX = hw - cornerDist;

  // Calculate where arc intersects the straight corner line
  // Arc is centered at basket, radius = threeR
  // Intersection with x = ±cornerX: y = basketY - sqrt(threeR² - cornerX²)
  const dx = hw - cornerDist;
  const innerSq = threeR * threeR - dx * dx;
  const arcStartY = innerSq > 0 ? Math.sqrt(innerSq) : 0;

  // Corrected: the three-point line starts from the baseline straight
  const sideLeft = hw - cornerDist;
  const straightEndY = (hl - details.basketFromBL - arcStartY) * sign;

  // Left corner straight line
  const lcb = t.toSvg(-sideLeft, baselineY);
  const lce = t.toSvg(-sideLeft, straightEndY);
  let svg = `<line x1="${lcb.x}" y1="${lcb.y}" x2="${lce.x}" y2="${lce.y}" stroke="${lineColor}" stroke-width="${lineW}"/>`;

  // Right corner straight line
  const rcb = t.toSvg(sideLeft, baselineY);
  const rce = t.toSvg(sideLeft, straightEndY);
  svg += `<line x1="${rcb.x}" y1="${rcb.y}" x2="${rce.x}" y2="${rce.y}" stroke="${lineColor}" stroke-width="${lineW}"/>`;

  // Arc between the corners
  const sweepFlag = mirror ? 0 : 1;
  svg += `<path d="M ${lce.x},${lce.y} A ${arcR},${arcR} 0 0,${sweepFlag} ${rce.x},${rce.y}" fill="none" stroke="${lineColor}" stroke-width="${lineW}"/>`;

  return svg;
}

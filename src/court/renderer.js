/**
 * OCF JSON → SVG Renderer.
 * Renders a complete OCF document for a given frame index.
 */

import { resolveCoordinate, COURT_DIMENSIONS } from './positions.js';
import { createTransform, renderCourtSVG } from './court-svg.js';
import { curvedPath, straightPath, dribblingPath } from './curves.js';

/** Default FIBA color scheme */
const DEFAULT_COLORS = {
  offense_fill:   '#003366',
  offense_stroke: '#ffffff',
  defense_fill:   '#58001d',
  defense_stroke: '#ffffff',
  black:          '#000000',
  grey:           '#7f7f7f',
  yellow:         '#ffff00',
  green:          '#7ce86a',
  red:            '#ff0000',
  blue:           '#5dd5ff',
  white:          '#ffffff',
};

/**
 * Get resolved color from a color_role string.
 */
function getColor(role, scheme) {
  if (!role) return scheme.black;
  if (role === 'offense') return scheme.offense_fill;
  if (role === 'defense') return scheme.defense_fill;
  return scheme[role] || scheme.black;
}

/**
 * Build the color scheme from doc overrides + defaults.
 */
export function buildColorScheme(docScheme) {
  return { ...DEFAULT_COLORS, ...(docScheme || {}) };
}

/**
 * Resolve entity positions for a given frame index.
 * Frame 0 uses entity_states delta on top of base entities.
 * Frame N uses delta on top of frame N-1 positions.
 * 
 * @param {Object} doc - Full OCF document
 * @param {number} frameIndex - Which frame to resolve
 * @returns {Map<string, {x:number, y:number, entity:Object}>} entityKey → position + entity data
 */
export function resolveEntityPositions(doc, frameIndex) {
  const positions = new Map();

  // Base positions from entities[]
  for (const entity of (doc.entities || [])) {
    const key = entityKey(entity);
    positions.set(key, { x: entity.x, y: entity.y, entity });
  }

  // Apply frame deltas up to frameIndex
  const frames = doc.frames || [];
  for (let f = 0; f <= Math.min(frameIndex, frames.length - 1); f++) {
    const frame = frames[f];
    if (frame.entity_states) {
      for (const [key, state] of Object.entries(frame.entity_states)) {
        const existing = positions.get(key);
        if (existing) {
          positions.set(key, { ...existing, x: state.x, y: state.y });
        }
      }
    }
  }

  return positions;
}

/**
 * Get the natural key for an entity.
 */
export function entityKey(entity) {
  if (entity.type === 'ball' || entity.type === 'coach') return entity.type;
  return `${entity.type}_${entity.nr}`;
}

/**
 * Render a complete OCF document to SVG content (inner SVG, no outer <svg> tag).
 * 
 * @param {Object} doc - OCF JSON document
 * @param {number} frameIndex - Frame to render
 * @param {number} svgWidth - Target SVG width in pixels
 * @param {number} svgHeight - Target SVG height in pixels
 * @param {Object} [options] - Rendering options
 * @returns {{ svgContent: string, transform: Object }}
 */
export function renderOCF(doc, frameIndex, svgWidth, svgHeight, options = {}) {
  const ruleset = doc.court?.ruleset || 'fiba';
  const courtType = doc.court?.type || 'half_court';
  const scheme = buildColorScheme(doc.color_scheme);
  const customPositions = doc.named_positions?.custom || {};
  const transform = createTransform(ruleset, courtType, svgWidth, svgHeight);

  let svg = '';

  // SVG defs (markers, gradients)
  svg += renderDefs(scheme, transform);

  // Z-order: areas → court → lines → cones → players → ball → labels

  // 1. Areas
  svg += renderAreas(doc.areas || [], transform, scheme, ruleset, customPositions);

  // 2. Court background
  svg += renderCourtSVG(ruleset, courtType, transform);

  // 3. Lines for current frame
  const frame = (doc.frames || [])[frameIndex];
  const entityPositions = resolveEntityPositions(doc, frameIndex);
  if (frame) {
    svg += renderLines(frame.lines || [], transform, scheme, ruleset, customPositions, entityPositions);
  }

  // Sort entities by z-order: cones first, then players, then ball
  const cones = [];
  const players = [];
  const balls = [];
  const stations = [];

  for (const [key, pos] of entityPositions) {
    const e = pos.entity;
    if (e.type === 'cone') cones.push(pos);
    else if (e.type === 'ball') balls.push(pos);
    else if (e.type === 'station') stations.push(pos);
    else players.push(pos);
  }

  // 4. Cones
  for (const pos of cones) svg += renderCone(pos, transform, scheme);

  // 5. Players (offense, defense, coach)
  for (const pos of players) svg += renderPlayer(pos, transform, scheme);

  // 6. Ball
  for (const pos of balls) svg += renderBall(pos, transform, scheme);

  // 7. Labels + stations
  for (const pos of stations) svg += renderStation(pos, transform, scheme);
  svg += renderLabels(doc.labels || [], transform, scheme);

  return { svgContent: svg, transform };
}

/**
 * Render SVG <defs> for markers and gradients.
 */
function renderDefs(scheme, transform) {
  return `<defs>
    <!-- Arrow marker -->
    <marker id="ocf-arrow" viewBox="0 0 8 6" refX="8" refY="3" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0,0 L 8,3 L 0,6 Z" fill="${scheme.black}"/>
    </marker>
    <marker id="ocf-arrow-grey" viewBox="0 0 8 6" refX="8" refY="3" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0,0 L 8,3 L 0,6 Z" fill="${scheme.grey}"/>
    </marker>
    <!-- Screen crossbar marker -->
    <marker id="ocf-screen" viewBox="0 0 2 10" refX="1" refY="5" markerWidth="2" markerHeight="10" orient="auto">
      <line x1="1" y1="0" x2="1" y2="10" stroke="${scheme.black}" stroke-width="2"/>
    </marker>
    <!-- Ball gradient -->
    <radialGradient id="ocf-ball-gradient" cx="40%" cy="35%">
      <stop offset="0%" stop-color="#ff9933"/>
      <stop offset="100%" stop-color="#cc5500"/>
    </radialGradient>
    <!-- Cone gradient -->
    <linearGradient id="ocf-cone-gradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ff3300"/>
      <stop offset="50%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#ff3300"/>
    </linearGradient>
  </defs>`;
}

/**
 * Render lines for a frame.
 */
function renderLines(lines, transform, scheme, ruleset, customPositions, entityPositions) {
  let svg = '';
  for (const line of lines) {
    svg += renderLine(line, transform, scheme, ruleset, customPositions, entityPositions);
  }
  return svg;
}

function renderLine(line, transform, scheme, ruleset, customPositions, entityPositions) {
  // Resolve coordinates
  const resolvedCoords = (line.coords || []).map(c => {
    const abs = resolveCoordinate(c, ruleset, customPositions);
    return transform.toSvg(abs.x, abs.y);
  });

  if (resolvedCoords.length < 2) return '';

  const color = line.color ? getColor(line.color, scheme) : scheme.black;
  let pathD, strokeDash = '', markerEnd = '', strokeWidth = 2;

  switch (line.type) {
    case 'movement':
      pathD = line.curved ? curvedPath(resolvedCoords) : straightPath(resolvedCoords);
      markerEnd = 'url(#ocf-arrow)';
      break;
    case 'passing':
      pathD = line.curved ? curvedPath(resolvedCoords) : straightPath(resolvedCoords);
      strokeDash = '6,4';
      markerEnd = 'url(#ocf-arrow)';
      break;
    case 'dribbling':
      pathD = dribblingPath(resolvedCoords, 1);
      markerEnd = 'url(#ocf-arrow)';
      break;
    case 'screen':
      pathD = line.curved ? curvedPath(resolvedCoords) : straightPath(resolvedCoords);
      markerEnd = 'url(#ocf-screen)';
      strokeWidth = 3;
      break;
    case 'line':
      pathD = line.curved ? curvedPath(resolvedCoords) : straightPath(resolvedCoords);
      break;
    case 'free':
      pathD = straightPath(resolvedCoords);
      break;
    default:
      pathD = straightPath(resolvedCoords);
  }

  let attrs = `fill="none" stroke="${color}" stroke-width="${strokeWidth}"`;
  if (strokeDash) attrs += ` stroke-dasharray="${strokeDash}"`;
  if (markerEnd) attrs += ` marker-end="${markerEnd}"`;
  attrs += ` stroke-linecap="round" stroke-linejoin="round"`;

  return `<path d="${pathD}" ${attrs}/>`;
}

/**
 * Render an offense/defense/coach player entity.
 */
function renderPlayer(pos, transform, scheme) {
  const e = pos.entity;
  const svgPos = transform.toSvg(pos.x, pos.y);
  const r = 12; // player symbol radius in pixels
  let svg = '';

  if (e.type === 'offense') {
    const fill = e.color ? getColor(e.color, scheme) : scheme.offense_fill;
    // White outline for contrast
    svg += `<circle cx="${svgPos.x}" cy="${svgPos.y}" r="${r + 2}" fill="white" opacity="0.9"/>`;
    svg += `<circle cx="${svgPos.x}" cy="${svgPos.y}" r="${r}" fill="${fill}" stroke="${scheme.offense_stroke}" stroke-width="1.5"/>`;
    svg += `<text x="${svgPos.x}" y="${svgPos.y}" text-anchor="middle" dominant-baseline="central" fill="${scheme.offense_stroke}" font-size="13" font-weight="bold" font-family="Arial, sans-serif">${e.nr}</text>`;
  } else if (e.type === 'defense') {
    const fill = e.color ? getColor(e.color, scheme) : scheme.defense_fill;
    // Defense: arc + inner circle
    svg += `<circle cx="${svgPos.x}" cy="${svgPos.y}" r="${r + 2}" fill="white" opacity="0.9"/>`;
    // Outer arc (defense symbol)
    const arcR = r + 1;
    svg += `<path d="M ${svgPos.x - arcR},${svgPos.y + arcR * 0.5} C ${svgPos.x - arcR},${svgPos.y - arcR * 1.2} ${svgPos.x + arcR},${svgPos.y - arcR * 1.2} ${svgPos.x + arcR},${svgPos.y + arcR * 0.5}" fill="none" stroke="${fill}" stroke-width="2.5"/>`;
    // Inner circle
    svg += `<circle cx="${svgPos.x}" cy="${svgPos.y}" r="${r * 0.7}" fill="${fill}" stroke="${scheme.defense_stroke}" stroke-width="1"/>`;
    svg += `<text x="${svgPos.x}" y="${svgPos.y}" text-anchor="middle" dominant-baseline="central" fill="${scheme.defense_stroke}" font-size="11" font-weight="bold" font-family="Arial, sans-serif">${e.nr}</text>`;
  } else if (e.type === 'coach') {
    svg += `<circle cx="${svgPos.x}" cy="${svgPos.y}" r="${r + 2}" fill="white" opacity="0.9"/>`;
    svg += `<circle cx="${svgPos.x}" cy="${svgPos.y}" r="${r}" fill="none" stroke="#de4814" stroke-width="2.5"/>`;
    svg += `<text x="${svgPos.x}" y="${svgPos.y}" text-anchor="middle" dominant-baseline="central" fill="#de4814" font-size="13" font-weight="bold" font-family="Arial, sans-serif">C</text>`;
  }

  return svg;
}

/**
 * Render ball entity.
 */
function renderBall(pos, transform, scheme) {
  const svgPos = transform.toSvg(pos.x, pos.y);
  const rx = 8, ry = 7.5;
  let svg = '';
  svg += `<ellipse cx="${svgPos.x}" cy="${svgPos.y}" rx="${rx}" ry="${ry}" fill="url(#ocf-ball-gradient)" stroke="#993300" stroke-width="1"/>`;
  // Seam lines
  svg += `<path d="M ${svgPos.x - 2},${svgPos.y - ry + 1} Q ${svgPos.x - 4},${svgPos.y} ${svgPos.x - 2},${svgPos.y + ry - 1}" fill="none" stroke="#66330099" stroke-width="0.8"/>`;
  svg += `<path d="M ${svgPos.x + 2},${svgPos.y - ry + 1} Q ${svgPos.x + 4},${svgPos.y} ${svgPos.x + 2},${svgPos.y + ry - 1}" fill="none" stroke="#66330099" stroke-width="0.8"/>`;
  return svg;
}

/**
 * Render cone entity.
 */
function renderCone(pos, transform, scheme) {
  const svgPos = transform.toSvg(pos.x, pos.y);
  return `<path d="M ${svgPos.x - 5},${svgPos.y + 8} L ${svgPos.x + 0.5},${svgPos.y - 9} L ${svgPos.x + 1.5},${svgPos.y - 9} L ${svgPos.x + 5},${svgPos.y + 8} Z" fill="url(#ocf-cone-gradient)" stroke="#cc3300" stroke-width="0.8"/>`;
}

/**
 * Render station entity.
 */
function renderStation(pos, transform, scheme) {
  const e = pos.entity;
  const svgPos = transform.toSvg(pos.x, pos.y);
  let svg = '';
  svg += `<rect x="${svgPos.x - 14}" y="${svgPos.y - 10}" width="28" height="20" rx="4" fill="#ffffff" stroke="${scheme.black}" stroke-width="1.5"/>`;
  svg += `<text x="${svgPos.x}" y="${svgPos.y}" text-anchor="middle" dominant-baseline="central" fill="${scheme.black}" font-size="12" font-weight="bold" font-family="Arial, sans-serif">${e.label || e.nr}</text>`;
  return svg;
}

/**
 * Render areas.
 */
function renderAreas(areas, transform, scheme, ruleset, customPositions) {
  let svg = '';
  for (const area of areas) {
    const color = area.color ? getColor(area.color, scheme) : scheme.yellow;
    const opacity = area.opacity !== undefined ? area.opacity : 0.3;

    if (area.form === 'rectangle') {
      const tl = transform.toSvg(area.x, area.y);
      const br = transform.toSvg(area.x + (area.width || 2), area.y - (area.height || 2));
      svg += `<rect x="${tl.x}" y="${tl.y}" width="${Math.abs(br.x - tl.x)}" height="${Math.abs(br.y - tl.y)}" fill="${color}" opacity="${opacity}" rx="2"/>`;
    } else if (area.form === 'ellipse') {
      const center = transform.toSvg(area.x, area.y);
      const rx = transform.s((area.width || 2) / 2);
      const ry = transform.s((area.height || 2) / 2);
      svg += `<ellipse cx="${center.x}" cy="${center.y}" rx="${rx}" ry="${ry}" fill="${color}" opacity="${opacity}"/>`;
    } else if (area.form === 'triangle' && area.coords) {
      const pts = area.coords.map(c => {
        const abs = resolveCoordinate(c, ruleset, customPositions);
        return transform.toSvg(abs.x, abs.y);
      });
      const pointsStr = pts.map(p => `${p.x},${p.y}`).join(' ');
      svg += `<polygon points="${pointsStr}" fill="${color}" opacity="${opacity}"/>`;
    }
  }
  return svg;
}

/**
 * Render text labels.
 */
function renderLabels(labels, transform, scheme) {
  let svg = '';
  for (const label of labels) {
    const pos = transform.toSvg(label.x, label.y);
    const color = label.color ? getColor(label.color, scheme) : scheme.black;
    svg += `<text x="${pos.x}" y="${pos.y}" text-anchor="middle" fill="${color}" font-size="13" font-family="Arial, sans-serif" font-weight="600">${escapeHtml(label.text)}</text>`;
  }
  return svg;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

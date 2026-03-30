/**
 * Named Position Registry for all basketball rulesets.
 * Coordinates: origin = midcourt center.
 * y+ = frontcourt (offense basket side).
 */

const FIBA_POSITIONS = {
  basket:               { x:  0.000, y: 12.425 },
  left_block:           { x: -2.450, y: 11.000 },
  right_block:          { x:  2.450, y: 11.000 },
  paint_center:         { x:  0.000, y: 10.500 },
  left_elbow:           { x: -2.450, y:  8.200 },
  right_elbow:          { x:  2.450, y:  8.200 },
  free_throw_line:      { x:  0.000, y:  8.200 },
  high_post_left:       { x: -2.450, y:  7.000 },
  high_post_right:      { x:  2.450, y:  7.000 },
  top_of_the_key:       { x:  0.000, y:  5.680 },
  left_wing:            { x: -6.750, y:  8.600 },
  right_wing:           { x:  6.750, y:  8.600 },
  left_corner:          { x: -7.500, y: 13.980 },
  right_corner:         { x:  7.500, y: 13.980 },
  left_short_corner:    { x: -7.500, y: 11.500 },
  right_short_corner:   { x:  7.500, y: 11.500 },

  // Midcourt
  'midcourt.center':    { x:  0.000, y:  0.000 },
  'midcourt.left':      { x: -7.500, y:  0.000 },
  'midcourt.right':     { x:  7.500, y:  0.000 },

  // Inbound
  'inbound.baseline_left':       { x: -3.0, y: 14.0 },
  'inbound.baseline_right':      { x:  3.0, y: 14.0 },
  'inbound.baseline_center':     { x:  0.0, y: 14.0 },
  'inbound.sideline_left_fc':    { x: -7.5, y:  8.2 },
  'inbound.sideline_right_fc':   { x:  7.5, y:  8.2 },
  'inbound.sideline_left_mid':   { x: -7.5, y:  0.0 },
  'inbound.sideline_right_mid':  { x:  7.5, y:  0.0 },
  'inbound.sideline_left_bc':    { x: -7.5, y: -8.2 },
  'inbound.sideline_right_bc':   { x:  7.5, y: -8.2 },
};

// NBA positions (ft) - proportionally mapped to NBA court
const NBA_POSITIONS = {
  basket:               { x:  0.000, y: 41.75  },
  left_block:           { x: -8.000, y: 37.00  },
  right_block:          { x:  8.000, y: 37.00  },
  paint_center:         { x:  0.000, y: 35.25  },
  left_elbow:           { x: -8.000, y: 27.75  },
  right_elbow:          { x:  8.000, y: 27.75  },
  free_throw_line:      { x:  0.000, y: 27.75  },
  high_post_left:       { x: -8.000, y: 23.50  },
  high_post_right:      { x:  8.000, y: 23.50  },
  top_of_the_key:       { x:  0.000, y: 19.00  },
  left_wing:            { x: -22.00, y: 28.75  },
  right_wing:           { x:  22.00, y: 28.75  },
  left_corner:          { x: -22.00, y: 47.00  },
  right_corner:         { x:  22.00, y: 47.00  },
  left_short_corner:    { x: -22.00, y: 38.50  },
  right_short_corner:   { x:  22.00, y: 38.50  },

  'midcourt.center':    { x:  0.000, y:  0.000 },
  'midcourt.left':      { x: -25.00, y:  0.000 },
  'midcourt.right':     { x:  25.00, y:  0.000 },

  'inbound.baseline_left':       { x: -10.0, y: 47.0 },
  'inbound.baseline_right':      { x:  10.0, y: 47.0 },
  'inbound.baseline_center':     { x:   0.0, y: 47.0 },
  'inbound.sideline_left_fc':    { x: -25.0, y: 27.75 },
  'inbound.sideline_right_fc':   { x:  25.0, y: 27.75 },
  'inbound.sideline_left_mid':   { x: -25.0, y:  0.0  },
  'inbound.sideline_right_mid':  { x:  25.0, y:  0.0  },
  'inbound.sideline_left_bc':    { x: -25.0, y: -27.75 },
  'inbound.sideline_right_bc':   { x:  25.0, y: -27.75 },
};

// NCAA same court as NBA
const NCAA_POSITIONS = { ...NBA_POSITIONS };

// NFHS (84ft court)
const NFHS_POSITIONS = {
  basket:               { x:  0.000, y: 36.75  },
  left_block:           { x: -8.000, y: 32.00  },
  right_block:          { x:  8.000, y: 32.00  },
  paint_center:         { x:  0.000, y: 30.25  },
  left_elbow:           { x: -8.000, y: 22.75  },
  right_elbow:          { x:  8.000, y: 22.75  },
  free_throw_line:      { x:  0.000, y: 22.75  },
  high_post_left:       { x: -8.000, y: 18.50  },
  high_post_right:      { x:  8.000, y: 18.50  },
  top_of_the_key:       { x:  0.000, y: 14.00  },
  left_wing:            { x: -22.00, y: 23.75  },
  right_wing:           { x:  22.00, y: 23.75  },
  left_corner:          { x: -22.00, y: 42.00  },
  right_corner:         { x:  22.00, y: 42.00  },
  left_short_corner:    { x: -22.00, y: 33.50  },
  right_short_corner:   { x:  22.00, y: 33.50  },

  'midcourt.center':    { x:  0.000, y:  0.000 },
  'midcourt.left':      { x: -25.00, y:  0.000 },
  'midcourt.right':     { x:  25.00, y:  0.000 },

  'inbound.baseline_left':       { x: -10.0, y: 42.0 },
  'inbound.baseline_right':      { x:  10.0, y: 42.0 },
  'inbound.baseline_center':     { x:   0.0, y: 42.0 },
  'inbound.sideline_left_fc':    { x: -25.0, y: 22.75 },
  'inbound.sideline_right_fc':   { x:  25.0, y: 22.75 },
  'inbound.sideline_left_mid':   { x: -25.0, y:  0.0  },
  'inbound.sideline_right_mid':  { x:  25.0, y:  0.0  },
  'inbound.sideline_left_bc':    { x: -25.0, y: -22.75 },
  'inbound.sideline_right_bc':   { x:  25.0, y: -22.75 },
};

const POSITION_REGISTRIES = {
  fiba: FIBA_POSITIONS,
  nba:  NBA_POSITIONS,
  ncaa: NCAA_POSITIONS,
  nfhs: NFHS_POSITIONS,
};

/** Court dimensions per ruleset */
export const COURT_DIMENSIONS = {
  fiba: { unit: 'm',  length: 28.0, width: 15.0, basketFromBaseline: 1.575, halfLength: 14.0, halfWidth: 7.5 },
  nba:  { unit: 'ft', length: 94.0, width: 50.0, basketFromBaseline: 5.25,  halfLength: 47.0, halfWidth: 25.0 },
  ncaa: { unit: 'ft', length: 94.0, width: 50.0, basketFromBaseline: 5.25,  halfLength: 47.0, halfWidth: 25.0 },
  nfhs: { unit: 'ft', length: 84.0, width: 50.0, basketFromBaseline: 5.25,  halfLength: 42.0, halfWidth: 25.0 },
};

/** Snap radius per unit type */
export const SNAP_RADIUS = { m: 0.3, ft: 1.0 };

/**
 * Generate backcourt mirror positions from frontcourt positions.
 * backcourt.X = { x: front.x, y: -front.y }
 */
function addBackcourtMirrors(positions) {
  const result = { ...positions };
  const frontcourtKeys = Object.keys(positions).filter(
    k => !k.startsWith('midcourt.') && !k.startsWith('inbound.') && !k.startsWith('backcourt.')
  );
  for (const key of frontcourtKeys) {
    const pos = positions[key];
    result[`backcourt.${key}`] = { x: pos.x, y: -pos.y };
  }
  return result;
}

/**
 * Get the full named position registry for a ruleset, including backcourt mirrors.
 * @param {string} ruleset - 'fiba' | 'nba' | 'ncaa' | 'nfhs'
 * @returns {Object<string, {x: number, y: number}>}
 */
export function getPositionRegistry(ruleset) {
  const base = POSITION_REGISTRIES[ruleset];
  if (!base) return {};
  return addBackcourtMirrors(base);
}

/**
 * Resolve a coordinate object to absolute {x, y}.
 * @param {Object} coord - Coordinate from OCF JSON
 * @param {string} ruleset - Current ruleset
 * @param {Object} customPositions - custom named positions from the doc
 * @returns {{x: number, y: number}}
 */
export function resolveCoordinate(coord, ruleset, customPositions = {}) {
  // Absolute
  if (coord.x !== undefined && coord.y !== undefined && !coord.relative_to) {
    return { x: coord.x, y: coord.y };
  }
  // Named
  if (coord.named) {
    if (coord.named.startsWith('custom.')) {
      const name = coord.named.slice(7);
      const pos = customPositions[name];
      if (!pos) throw new Error(`Unknown custom position: ${coord.named}`);
      return { x: pos.x, y: pos.y };
    }
    const registry = getPositionRegistry(ruleset);
    const pos = registry[coord.named];
    if (!pos) throw new Error(`Unknown named position: ${coord.named}`);
    return { x: pos.x, y: pos.y };
  }
  // Relative
  if (coord.relative_to) {
    const base = resolveCoordinate({ named: coord.relative_to }, ruleset, customPositions);
    return { x: base.x + (coord.dx || 0), y: base.y + (coord.dy || 0) };
  }
  throw new Error('Invalid coordinate: ' + JSON.stringify(coord));
}

/**
 * Get snap radius for a ruleset.
 */
export function getSnapRadius(ruleset) {
  const dims = COURT_DIMENSIONS[ruleset];
  return dims ? SNAP_RADIUS[dims.unit] : 0.3;
}

/**
 * Find nearest named position within snap radius.
 * @returns {{ name: string, x: number, y: number } | null}
 */
export function findSnapPosition(x, y, ruleset, customPositions = {}) {
  const radius = getSnapRadius(ruleset);
  const registry = getPositionRegistry(ruleset);
  const allPositions = { ...registry };
  for (const [k, v] of Object.entries(customPositions)) {
    allPositions[`custom.${k}`] = v;
  }

  let best = null;
  let bestDist = radius;
  for (const [name, pos] of Object.entries(allPositions)) {
    const dx = pos.x - x;
    const dy = pos.y - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < bestDist) {
      bestDist = dist;
      best = { name, x: pos.x, y: pos.y };
    }
  }
  return best;
}

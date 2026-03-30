/**
 * Simple OCF schema validator.
 * Performs structural validation without a full JSON Schema library.
 */

const VALID_RULESETS = ['fiba', 'nba', 'ncaa', 'nfhs', 'custom'];
const VALID_COURT_TYPES = ['half_court', 'full_court'];
const VALID_ENTITY_TYPES = ['offense', 'defense', 'ball', 'coach', 'cone', 'station'];
const VALID_LINE_TYPES = ['movement', 'passing', 'dribbling', 'screen', 'line', 'free'];
const VALID_COLOR_ROLES = ['offense', 'defense', 'black', 'grey', 'yellow', 'green', 'red', 'blue', 'white'];
const VALID_DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];
const VALID_DRILL_FOCUS = ['offense', 'defense', 'transition', 'neutral'];
const VALID_AREA_FORMS = ['rectangle', 'ellipse', 'triangle'];
const ENTITY_REF_REGEX = /^(offense|defense)_[1-9]$|^(ball|coach)$|^(cone|station)_[1-9][0-9]*$/;

/**
 * Validate an OCF document.
 * @param {Object} doc - The document to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateOCF(doc) {
  const errors = [];

  if (!doc || typeof doc !== 'object') {
    return { valid: false, errors: ['Document must be an object'] };
  }

  // Required fields
  if (!doc.meta) errors.push('Missing required field: meta');
  if (!doc.court) errors.push('Missing required field: court');
  if (!doc.entities) errors.push('Missing required field: entities');
  if (!doc.frames) errors.push('Missing required field: frames');

  // Meta
  if (doc.meta) {
    if (!doc.meta.id) errors.push('meta.id is required');
    if (!doc.meta.title) errors.push('meta.title is required');
    if (doc.meta.difficulty && !VALID_DIFFICULTIES.includes(doc.meta.difficulty)) {
      errors.push(`Invalid difficulty: ${doc.meta.difficulty}`);
    }
    if (doc.meta.tags && !Array.isArray(doc.meta.tags)) {
      errors.push('meta.tags must be an array');
    }
  }

  // Court
  if (doc.court) {
    if (!VALID_RULESETS.includes(doc.court.ruleset)) {
      errors.push(`Invalid ruleset: ${doc.court.ruleset}`);
    }
    if (!VALID_COURT_TYPES.includes(doc.court.type)) {
      errors.push(`Invalid court type: ${doc.court.type}`);
    }
    if (doc.court.drill_focus && !VALID_DRILL_FOCUS.includes(doc.court.drill_focus)) {
      errors.push(`Invalid drill_focus: ${doc.court.drill_focus}`);
    }
    if (doc.court.ruleset === 'custom' && !doc.court.custom_dimensions) {
      errors.push('custom_dimensions required when ruleset is "custom"');
    }
  }

  // Entities
  if (Array.isArray(doc.entities)) {
    doc.entities.forEach((e, i) => {
      if (!VALID_ENTITY_TYPES.includes(e.type)) {
        errors.push(`entities[${i}]: invalid type "${e.type}"`);
      }
      if (typeof e.x !== 'number' || typeof e.y !== 'number') {
        errors.push(`entities[${i}]: x and y must be numbers`);
      }
      if ((e.type === 'offense' || e.type === 'defense') && (typeof e.nr !== 'number' || e.nr < 1 || e.nr > 9)) {
        errors.push(`entities[${i}]: nr must be 1-9 for ${e.type}`);
      }
      if ((e.type === 'cone' || e.type === 'station') && typeof e.nr !== 'number') {
        errors.push(`entities[${i}]: nr is required for ${e.type}`);
      }
      if (e.color && !VALID_COLOR_ROLES.includes(e.color)) {
        errors.push(`entities[${i}]: invalid color "${e.color}"`);
      }
    });
  } else if (doc.entities) {
    errors.push('entities must be an array');
  }

  // Frames
  if (Array.isArray(doc.frames)) {
    if (doc.frames.length < 1) {
      errors.push('At least one frame is required');
    }
    doc.frames.forEach((f, fi) => {
      if (!f.id) errors.push(`frames[${fi}]: id is required`);
      if (!Array.isArray(f.lines)) errors.push(`frames[${fi}]: lines must be an array`);
      if (f.lines) {
        f.lines.forEach((l, li) => {
          if (!VALID_LINE_TYPES.includes(l.type)) {
            errors.push(`frames[${fi}].lines[${li}]: invalid type "${l.type}"`);
          }
          if (!Array.isArray(l.coords) || l.coords.length < 2) {
            errors.push(`frames[${fi}].lines[${li}]: coords must have at least 2 points`);
          }
          if (l.from_entity && !ENTITY_REF_REGEX.test(l.from_entity)) {
            errors.push(`frames[${fi}].lines[${li}]: invalid from_entity "${l.from_entity}"`);
          }
          if (l.to_entity && !ENTITY_REF_REGEX.test(l.to_entity)) {
            errors.push(`frames[${fi}].lines[${li}]: invalid to_entity "${l.to_entity}"`);
          }
          if (l.color && !VALID_COLOR_ROLES.includes(l.color)) {
            errors.push(`frames[${fi}].lines[${li}]: invalid color "${l.color}"`);
          }
        });
      }
      if (f.entity_states) {
        for (const [key, state] of Object.entries(f.entity_states)) {
          if (!ENTITY_REF_REGEX.test(key)) {
            errors.push(`frames[${fi}].entity_states: invalid key "${key}"`);
          }
          if (typeof state.x !== 'number' || typeof state.y !== 'number') {
            errors.push(`frames[${fi}].entity_states.${key}: x and y must be numbers`);
          }
        }
      }
    });
  } else if (doc.frames) {
    errors.push('frames must be an array');
  }

  // Areas
  if (doc.areas && Array.isArray(doc.areas)) {
    doc.areas.forEach((a, i) => {
      if (!VALID_AREA_FORMS.includes(a.form)) {
        errors.push(`areas[${i}]: invalid form "${a.form}"`);
      }
      if (typeof a.x !== 'number' || typeof a.y !== 'number') {
        errors.push(`areas[${i}]: x and y must be numbers`);
      }
    });
  }

  // Labels
  if (doc.labels && Array.isArray(doc.labels)) {
    doc.labels.forEach((l, i) => {
      if (!l.text) errors.push(`labels[${i}]: text is required`);
      if (typeof l.x !== 'number' || typeof l.y !== 'number') {
        errors.push(`labels[${i}]: x and y must be numbers`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

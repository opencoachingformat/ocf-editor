/**
 * OCF JSON Import / Export.
 */

import { validateOCF } from './validate.js';

/**
 * Export an OCF document as a downloadable JSON file.
 * Validates before export.
 * @param {Object} doc - OCF document
 * @param {string} [filename] - Download filename
 * @returns {{ success: boolean, errors?: string[] }}
 */
export function exportJSON(doc, filename) {
  const result = validateOCF(doc);
  if (!result.valid) {
    return { success: false, errors: result.errors };
  }

  // Clean up: update modified timestamp
  const exportDoc = JSON.parse(JSON.stringify(doc));
  exportDoc.meta.modified = new Date().toISOString();

  // Remove undefined/null fields for clean output
  const cleanDoc = cleanObject(exportDoc);

  const json = JSON.stringify(cleanDoc, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `${slugify(doc.meta.title || 'drill')}.ocf.json`;
  a.click();

  URL.revokeObjectURL(url);
  return { success: true };
}

/**
 * Import an OCF JSON file.
 * @returns {Promise<{ doc?: Object, errors?: string[] }>}
 */
export function importJSON() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.ocf.json';

    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return resolve({ errors: ['No file selected'] });

      try {
        const text = await file.text();
        const doc = JSON.parse(text);
        const result = validateOCF(doc);
        if (!result.valid) {
          resolve({ errors: result.errors });
        } else {
          resolve({ doc });
        }
      } catch (e) {
        resolve({ errors: [`Failed to parse JSON: ${e.message}`] });
      }
    });

    input.click();
  });
}

/**
 * Import from a JSON string (for paste).
 */
export function importFromString(jsonStr) {
  try {
    const doc = JSON.parse(jsonStr);
    const result = validateOCF(doc);
    if (!result.valid) return { errors: result.errors };
    return { doc };
  } catch (e) {
    return { errors: [`Failed to parse JSON: ${e.message}`] };
  }
}

/**
 * Get the current document as formatted JSON string.
 */
export function toJSONString(doc) {
  return JSON.stringify(cleanObject(doc), null, 2);
}

/** Remove undefined and null values from an object recursively. */
function cleanObject(obj) {
  if (Array.isArray(obj)) return obj.map(cleanObject);
  if (obj && typeof obj === 'object') {
    const clean = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined && v !== null) {
        clean[k] = cleanObject(v);
      }
    }
    return clean;
  }
  return obj;
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

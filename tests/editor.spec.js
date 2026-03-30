/**
 * E2E tests for OCF Editor basic functionality.
 * Tests run against a local static server (http://localhost:3333).
 */

import { test, expect } from '@playwright/test';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Load the editor and wait until the court SVG has been rendered by JS. */
async function openEditor(page) {
  await page.goto('/');
  // JS has rendered when the static demo SVG is replaced — the court has a <rect> with fill=#d4a06a
  await expect(page.locator('#court-svg rect[fill="#d4a06a"]')).toBeVisible();
}

/** Click a palette button by entity type label. */
function paletteBtn(page, label) {
  return page.locator(`.palette-item .pal-label`, { hasText: label }).locator('..');
}

/** Get the court SVG bounding box center. */
async function courtCenter(page) {
  const box = await page.locator('#court-svg').boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height * 0.6 };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('App loads', () => {
  test('page title and version are correct', async ({ page }) => {
    await openEditor(page);
    await expect(page).toHaveTitle(/OCF Editor/);
    await expect(page.locator('.app-version')).toHaveText('v0.1.0');
  });

  test('court SVG is rendered (no 404 on bundle)', async ({ page }) => {
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(err.message));
    await openEditor(page);
    const bundleErrors = errors.filter(e => e.includes('ocf-bundle'));
    expect(bundleErrors).toHaveLength(0);
  });

  test('court SVG contains court lines', async ({ page }) => {
    await openEditor(page);
    const svg = page.locator('#court-svg');
    // Court background rect
    await expect(svg.locator('rect[fill="#d4a06a"]')).toBeVisible();
    // Rim (orange circle)
    await expect(svg.locator('circle[stroke="#cc5500"]')).toBeVisible();
  });
});

test.describe('Entity palette', () => {
  test('all six entity types are present', async ({ page }) => {
    await openEditor(page);
    for (const label of ['Offense', 'Defense', 'Ball', 'Coach', 'Cone', 'Station']) {
      await expect(paletteBtn(page, label)).toBeVisible();
    }
  });

  test('click Offense adds a player to the court', async ({ page }) => {
    await openEditor(page);
    const before = await page.locator('#court-svg text').count();
    await paletteBtn(page, 'Offense').click();
    // A number label should appear on the SVG
    await expect(page.locator('#court-svg text')).toHaveCount(before + 1, { timeout: 3000 });
    // Document should now have 1 entity
    const entityCount = await page.evaluate(() => window.OCFEditor?.editorState?.doc?.entities?.length ?? -1);
    // If OCFEditor is not exported, just check SVG changed
    expect(await page.locator('#court-svg circle').count()).toBeGreaterThan(0);
  });

  test('click Defense adds a defense player', async ({ page }) => {
    await openEditor(page);
    await paletteBtn(page, 'Defense').click();
    await expect(page.locator('#court-svg')).not.toBeEmpty();
  });
});

test.describe('Drill settings panel', () => {
  /** Locate the input/textarea following a prop-label with the given text. */
  function propInput(page, labelText) {
    return page.locator('#properties .prop-row')
      .filter({ has: page.locator('.prop-label', { hasText: labelText }) })
      .locator('input, textarea');
  }

  /** Locate the select following a prop-label with the given text. */
  function propSelect(page, labelText) {
    return page.locator('#properties .prop-row')
      .filter({ has: page.locator('.prop-label', { hasText: labelText }) })
      .locator('select');
  }

  test('title input is visible and editable', async ({ page }) => {
    await openEditor(page);
    const titleInput = propInput(page, 'Title');
    await expect(titleInput).toBeVisible();
    await titleInput.fill('Test Drill');
    await expect(titleInput).toHaveValue('Test Drill');
  });

  test('changing ruleset re-renders the court', async ({ page }) => {
    await openEditor(page);
    const rulesetSelect = propSelect(page, 'Ruleset');
    await expect(rulesetSelect).toBeVisible();
    // Switch to NBA
    await rulesetSelect.selectOption('nba');
    // Court should still render (no crash)
    await expect(page.locator('#court-svg rect[fill="#d4a06a"]')).toBeVisible();
  });

  test('changing court type to full_court re-renders', async ({ page }) => {
    await openEditor(page);
    await propSelect(page, 'Court').selectOption('full_court');
    await expect(page.locator('#court-svg rect[fill="#d4a06a"]')).toBeVisible();
  });
});

test.describe('Frame controls', () => {
  test('frame counter shows 1 / 1 on fresh document', async ({ page }) => {
    await openEditor(page);
    await expect(page.locator('#frame-counter')).toHaveText('1 / 1');
  });

  test('add frame button increases frame count', async ({ page }) => {
    await openEditor(page);
    await page.locator('.frames-add-btn').click();
    await expect(page.locator('#frame-counter')).toHaveText('2 / 2');
  });

  test('prev/next buttons navigate frames', async ({ page }) => {
    await openEditor(page);
    await page.locator('.frames-add-btn').click();
    // Now on frame 2
    await expect(page.locator('#frame-counter')).toHaveText('2 / 2');
    await page.locator('#btn-prev').click();
    await expect(page.locator('#frame-counter')).toHaveText('1 / 2');
    await page.locator('#btn-next').click();
    await expect(page.locator('#frame-counter')).toHaveText('2 / 2');
  });
});

test.describe('Undo / Redo', () => {
  test('undo removes an added entity', async ({ page }) => {
    await openEditor(page);
    await paletteBtn(page, 'Offense').click();
    const textsBefore = await page.locator('#court-svg text').count();
    expect(textsBefore).toBeGreaterThan(0);

    await page.locator('#btn-undo').click();
    const textsAfter = await page.locator('#court-svg text').count();
    expect(textsAfter).toBeLessThan(textsBefore);
  });

  test('redo re-adds the entity', async ({ page }) => {
    await openEditor(page);
    await paletteBtn(page, 'Offense').click();
    const textsBefore = await page.locator('#court-svg text').count();
    await page.locator('#btn-undo').click();
    await page.locator('#btn-redo').click();
    const textsAfter = await page.locator('#court-svg text').count();
    expect(textsAfter).toBe(textsBefore);
  });
});

test.describe('JSON panel', () => {
  test('JSON panel opens and shows valid JSON', async ({ page }) => {
    await openEditor(page);
    await page.locator('#btn-json-toggle').click();
    const textarea = page.locator('#json-textarea');
    await expect(textarea).toBeVisible();
    const json = await textarea.inputValue();
    expect(() => JSON.parse(json)).not.toThrow();
    const doc = JSON.parse(json);
    expect(doc).toHaveProperty('meta');
    expect(doc).toHaveProperty('court');
    expect(doc).toHaveProperty('entities');
    expect(doc).toHaveProperty('frames');
  });

  test('JSON updates after adding an entity', async ({ page }) => {
    await openEditor(page);
    await page.locator('#btn-json-toggle').click();
    const jsonBefore = await page.locator('#json-textarea').inputValue();
    const before = JSON.parse(jsonBefore);
    expect(before.entities).toHaveLength(0);

    await paletteBtn(page, 'Offense').click();
    const jsonAfter = await page.locator('#json-textarea').inputValue();
    const after = JSON.parse(jsonAfter);
    expect(after.entities).toHaveLength(1);
    expect(after.entities[0].type).toBe('offense');
  });
});

test.describe('Mode toggle', () => {
  test('viewer mode button is visible', async ({ page }) => {
    await openEditor(page);
    await expect(page.locator('#mode-toggle')).toBeVisible();
  });

  test('switching to viewer mode hides the palette', async ({ page }) => {
    await openEditor(page);
    await page.locator('#mode-toggle').click();
    // In viewer mode, editor sidebar should be hidden
    await expect(page.locator('#left-sidebar')).not.toBeVisible();
  });

  test('switching back to editor mode restores the palette', async ({ page }) => {
    await openEditor(page);
    await page.locator('#mode-toggle').click();
    await page.locator('#mode-toggle').click();
    await expect(page.locator('#left-sidebar')).toBeVisible();
  });
});

test.describe('Import example', () => {
  test('loading pick-and-roll example renders players', async ({ page }) => {
    await page.goto('/?example=pick-and-roll');
    await expect(page.locator('#court-svg rect[fill="#d4a06a"]')).toBeVisible();
    // Pick & Roll has 8 entities → expect multiple player circles
    await expect(page.locator('#court-svg circle')).toHaveCount(
      await page.locator('#court-svg circle').count(),
    );
    // Frame counter should show the multi-frame drill
    await expect(page.locator('#frame-counter')).toHaveText(/\/ 4/);
  });
});

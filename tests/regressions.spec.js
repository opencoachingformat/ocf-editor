/**
 * Regression tests for the editor bugfixes:
 *   #1 ball-possession button (context menu) was a no-op
 *   #2 drawn lines could never be selected / edited / deleted
 *   #3 snap indicator vanished during drag (wiped by the per-move re-render)
 *   #4 right-click deleted an entity instead of selecting it
 *   + offense/defense numbering must stay capped at 9 (schema limit)
 *
 * These drive the real bundle via the exposed `window.OCFEditor` globals
 * (`editorState`, `getCurrentTransform`).
 */

import { test, expect } from '@playwright/test';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function openEditor(page) {
  await page.goto('/');
  await expect(page.locator('#court-svg rect[fill="#d4a06a"]')).toBeVisible();
}

function paletteBtn(page, label) {
  return page.locator('.palette-item .pal-label', { hasText: label }).locator('..');
}

/** Convert a court coordinate to a client (viewport) point over the SVG, using
 *  the SVG screen CTM — correct at any rendered size (the court scales to 100%
 *  width, so client pixels do not equal viewBox units). */
async function courtToClient(page, courtX, courtY) {
  return await page.evaluate(([cx, cy]) => {
    const svg = document.getElementById('court-svg');
    const t = window.OCFEditor.getCurrentTransform();
    const v = t.toSvg(cx, cy); // viewBox coords
    const pt = svg.createSVGPoint();
    pt.x = v.x;
    pt.y = v.y;
    const s = pt.matrixTransform(svg.getScreenCTM()); // -> client coords
    return { x: s.x, y: s.y };
  }, [courtX, courtY]);
}

// ─── #1 Ball possession ───────────────────────────────────────────────────────

test.describe('Regression #1: ball possession button', () => {
  test('clicking Ball assigns the ball entity onto the selected player', async ({ page }) => {
    await openEditor(page);
    await paletteBtn(page, 'Offense').click();

    // Select the player → the floating action menu appears.
    await page.evaluate(() => window.OCFEditor.editorState.select('offense_1'));
    const ballBtn = page.locator('#ctx-btn-ball');
    await expect(ballBtn).toBeVisible();

    await ballBtn.click();

    const result = await page.evaluate(() => {
      const doc = window.OCFEditor.editorState.doc;
      const ball = doc.entities.find(e => e.type === 'ball');
      const player = doc.entities.find(e => e.type === 'offense' && e.nr === 1);
      return { ball, player };
    });

    // A ball entity now exists and sits on the player.
    expect(result.ball).toBeTruthy();
    expect(result.ball.x).toBeCloseTo(result.player.x, 5);
    expect(result.ball.y).toBeCloseTo(result.player.y, 5);
    // And the button reflects possession.
    await expect(ballBtn).toHaveClass(/active/);
  });

  test('assigning the ball on a later frame writes a frame delta, not the base', async ({ page }) => {
    await openEditor(page);
    await paletteBtn(page, 'Offense').click();

    await page.evaluate(() => {
      const s = window.OCFEditor.editorState;
      s.addFrame();          // currentFrameIndex -> 1
      s.select('offense_1');
    });
    await page.locator('#ctx-btn-ball').click();

    const res = await page.evaluate(() => {
      const doc = window.OCFEditor.editorState.doc;
      return {
        delta: doc.frames[1].entity_states?.ball || null,
        ballExists: doc.entities.some(e => e.type === 'ball'),
        frame0HasDelta: !!doc.frames[0].entity_states,
      };
    });

    expect(res.ballExists).toBe(true);
    expect(res.delta).toBeTruthy();        // possession recorded as a frame delta
    expect(res.frame0HasDelta).toBe(false); // base frame untouched
  });
});

// ─── #2 Line selection / editing / deletion ─────────────────────────────────────

test.describe('Regression #2: lines are selectable and deletable', () => {
  async function seedLine(page) {
    await page.evaluate(() => {
      const s = window.OCFEditor.editorState;
      const doc = JSON.parse(JSON.stringify(s.doc));
      doc.frames[0].lines = [
        { type: 'movement', curved: false, coords: [{ x: -4, y: 6 }, { x: 4, y: 6 }] },
      ];
      s.loadDocument(doc);
    });
  }

  test('clicking a drawn line selects it and shows its properties', async ({ page }) => {
    await openEditor(page);
    await seedLine(page);

    const mid = await courtToClient(page, 0, 6); // midpoint of the line
    await page.mouse.click(mid.x, mid.y);

    const selected = await page.evaluate(() => window.OCFEditor.editorState.selectedLineIndex);
    expect(selected).toBe(0);
    await expect(page.locator('#properties .prop-title')).toHaveText(/Line/);
  });

  test('a selected line can be deleted with the Delete key', async ({ page }) => {
    await openEditor(page);
    await seedLine(page);

    const mid = await courtToClient(page, 0, 6);
    await page.mouse.click(mid.x, mid.y);
    await expect.poll(() =>
      page.evaluate(() => window.OCFEditor.editorState.selectedLineIndex),
    ).toBe(0);

    await page.keyboard.press('Delete');

    const remaining = await page.evaluate(
      () => window.OCFEditor.editorState.doc.frames[0].lines.length,
    );
    expect(remaining).toBe(0);
  });
});

// ─── #3 Snap indicator ──────────────────────────────────────────────────────────

test.describe('Regression #3: snap indicator survives the per-move re-render', () => {
  test('snap indicator stays in the DOM across consecutive snapping moves', async ({ page }) => {
    await openEditor(page);
    await paletteBtn(page, 'Offense').click(); // fiba default: offense_1 at (0, 7)

    // Drive the real InteractionManager handlers with synthetic pointer events
    // so the sequence is deterministic. We snap onto two named positions in a row.
    const result = await page.evaluate(() => {
      const svg = document.getElementById('court-svg');
      const t = window.OCFEditor.getCurrentTransform();
      const ctm = svg.getScreenCTM();
      const toClient = (cx, cy) => {
        const v = t.toSvg(cx, cy);
        const p = svg.createSVGPoint();
        p.x = v.x; p.y = v.y;
        const s = p.matrixTransform(ctm);
        return { x: s.x, y: s.y };
      };
      const fire = (type, c, buttons) => svg.dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true, view: window,
        pointerId: 1, pointerType: 'mouse', isPrimary: true,
        clientX: c.x, clientY: c.y, button: 0, buttons,
      }));
      const isConnected = () => {
        const c = svg.querySelector('circle[stroke="#00cc66"]');
        return !!c && c.isConnected;
      };

      const start = toClient(0, 7);     // the player
      const snap1 = toClient(0, 8.2);   // free_throw_line (fiba)
      const snap2 = toClient(0, 5.68);  // top_of_the_key (fiba)

      fire('pointerdown', start, 1);
      fire('pointermove', snap1, 1);    // first snap → indicator created + appended
      const afterFirst = isConnected();
      fire('pointermove', snap2, 1);    // second snap → re-render wipes innerHTML
      const afterSecond = isConnected();
      fire('pointerup', snap2, 0);

      const player = window.OCFEditor.editorState.doc.entities.find(e => e.type === 'offense');
      return { afterFirst, afterSecond, movedTo: player.y };
    });

    // Sanity: the drag actually snapped the player onto the named position.
    expect(result.movedTo).toBeCloseTo(5.68, 5);
    expect(result.afterFirst).toBe(true);
    // The regression: before the fix the indicator was detached by the
    // per-move svg.innerHTML reset and never re-appended.
    expect(result.afterSecond).toBe(true);
  });
});

// ─── #4 Right-click ─────────────────────────────────────────────────────────────

test.describe('Regression #4: right-click selects instead of deleting', () => {
  test('right-clicking a player keeps it and selects it', async ({ page }) => {
    await openEditor(page);
    await paletteBtn(page, 'Offense').click();

    const before = await page.evaluate(
      () => window.OCFEditor.editorState.doc.entities.length,
    );

    const at = await courtToClient(page, 0, 7); // the offense default position
    await page.mouse.click(at.x, at.y, { button: 'right' });

    const after = await page.evaluate(() => ({
      count: window.OCFEditor.editorState.doc.entities.length,
      selected: window.OCFEditor.editorState.selectedEntityKey,
    }));

    expect(after.count).toBe(before); // not deleted
    expect(after.selected).toBe('offense_1'); // selected instead
  });
});

// ─── Numbering cap ──────────────────────────────────────────────────────────────

test.describe('Regression: offense/defense numbering capped at 9', () => {
  test('the 10th offense slot is unavailable (null) and cones are unaffected', async ({ page }) => {
    await openEditor(page);
    const result = await page.evaluate(() => {
      const s = window.OCFEditor.editorState;
      for (let i = 1; i <= 9; i++) {
        s.addEntity({ type: 'offense', nr: s.nextEntityNr('offense'), x: 0, y: i });
      }
      return {
        count: s.doc.entities.length,
        next: s.nextEntityNr('offense'),
        cone: s.nextEntityNr('cone'),
      };
    });
    expect(result.count).toBe(9);
    expect(result.next).toBeNull();
    expect(result.cone).toBe(1);
  });
});

// ─── Mobile / touch ─────────────────────────────────────────────────────────────

test.describe('Regression: touch dragging on a small screen', () => {
  // Narrow viewport → the court SVG is scaled well below its 700-unit viewBox,
  // and touch input is enabled. This guards both mobile fixes at once:
  //   - pointer events (mouse-only handlers never fired for touch)
  //   - CTM-based coordinate mapping (client px ≠ viewBox units when scaled)
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('an entity can be dragged with touch and lands at the right court spot', async ({ page }) => {
    await openEditor(page);

    // Add a player directly (avoids depending on the responsive sidebar layout).
    await page.evaluate(() => {
      window.OCFEditor.editorState.addEntity({ type: 'offense', nr: 1, x: 0, y: 7 });
    });

    const renderedWidth = await page.evaluate(
      () => document.getElementById('court-svg').getBoundingClientRect().width,
    );
    expect(renderedWidth).toBeLessThan(700); // confirms the SVG is scaled down

    const moved = await page.evaluate(() => {
      const svg = document.getElementById('court-svg');
      const t = window.OCFEditor.getCurrentTransform();
      const ctm = svg.getScreenCTM();
      const toClient = (cx, cy) => {
        const v = t.toSvg(cx, cy);
        const p = svg.createSVGPoint();
        p.x = v.x; p.y = v.y;
        const s = p.matrixTransform(ctm);
        return { x: s.x, y: s.y };
      };
      const fire = (type, c, buttons) => svg.dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true, view: window,
        pointerId: 1, pointerType: 'touch', isPrimary: true,
        clientX: c.x, clientY: c.y, button: 0, buttons,
      }));

      const from = toClient(0, 7);    // on the player
      const target = toClient(-3, 3); // empty spot, not a snap position
      fire('pointerdown', from, 1);
      fire('pointermove', target, 1);
      fire('pointerup', target, 0);

      const p = window.OCFEditor.editorState.doc.entities.find(e => e.type === 'offense');
      return { x: p.x, y: p.y };
    });

    expect(moved.x).toBeCloseTo(-3, 1);
    expect(moved.y).toBeCloseTo(3, 1);
  });
});

// ─── Mobile: touch-action + larger hit radius + dribble start ────────────────────

test.describe('Regression: court allows touch dragging (touch-action)', () => {
  test('the court SVG sets touch-action:none so the browser does not steal drags', async ({ page }) => {
    await openEditor(page);
    const ta = await page.evaluate(
      () => getComputedStyle(document.getElementById('court-svg')).touchAction,
    );
    // Without this the browser treats a finger drag as scroll/pan and fires
    // pointercancel, so entities could never be dragged on a phone.
    expect(ta).toBe('none');
  });
});

test.describe('Regression: generous touch hit radius', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('a finger tap slightly off the token still grabs and drags it', async ({ page }) => {
    await openEditor(page);
    await page.evaluate(() => {
      window.OCFEditor.editorState.addEntity({ type: 'offense', nr: 1, x: 0, y: 7 });
    });

    const moved = await page.evaluate(() => {
      const svg = document.getElementById('court-svg');
      const t = window.OCFEditor.getCurrentTransform();
      const ctm = svg.getScreenCTM();
      const toClientVB = (vx, vy) => {
        const p = svg.createSVGPoint();
        p.x = vx; p.y = vy;
        const s = p.matrixTransform(ctm);
        return { x: s.x, y: s.y };
      };
      const center = t.toSvg(0, 7); // player center in viewBox units
      // Tap 28 viewBox units away — outside the old 15-unit radius, inside the
      // new 42-unit touch radius.
      const tap = toClientVB(center.x + 28, center.y);
      const target = toClientVB(center.x + 28 + 60, center.y); // drag right
      const fire = (type, c, buttons) => svg.dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true, view: window,
        pointerId: 1, pointerType: 'touch', isPrimary: true,
        clientX: c.x, clientY: c.y, button: 0, buttons,
      }));
      fire('pointerdown', tap, 1);
      fire('pointermove', target, 1);
      fire('pointerup', target, 0);
      const p = window.OCFEditor.editorState.doc.entities.find(e => e.type === 'offense');
      return { x: p.x, y: p.y, selected: window.OCFEditor.editorState.selectedEntityKey };
    });

    expect(moved.selected).toBe('offense_1'); // the off-center tap still grabbed it
    expect(moved.x).toBeGreaterThan(0.5);      // and it actually moved right
  });
});

test.describe('Regression: drawing a line starts at the selected player', () => {
  test('startLineTool seeds the player as the first waypoint', async ({ page }) => {
    await openEditor(page);
    const res = await page.evaluate(() => {
      const s = window.OCFEditor.editorState;
      s.addEntity({ type: 'offense', nr: 1, x: 2, y: 6 });
      s.select('offense_1');
      s.startLineTool('line_dribbling', 'offense_1');
      return {
        tool: s.activeTool,
        first: s.lineWaypoints[0],
        count: s.lineWaypoints.length,
        from: s._lineFromEntity,
      };
    });
    expect(res.tool).toBe('line_dribbling');
    expect(res.count).toBe(1);
    expect(res.first).toEqual({ x: 2, y: 6 });
    expect(res.from).toBe('offense_1');
  });

  test('the context-menu Dribble button begins the line from that player', async ({ page }) => {
    await openEditor(page);
    await page.evaluate(() => {
      const s = window.OCFEditor.editorState;
      s.addEntity({ type: 'offense', nr: 1, x: -1, y: 5 });
      s.select('offense_1');
    });
    // The floating action menu is shown for the selected player.
    await page.locator('.ctx-menu .ctx-btn[data-tool="line_dribbling"]').click();
    const res = await page.evaluate(() => {
      const s = window.OCFEditor.editorState;
      return { count: s.lineWaypoints.length, first: s.lineWaypoints[0], from: s._lineFromEntity };
    });
    expect(res.count).toBe(1);
    expect(res.first).toEqual({ x: -1, y: 5 });
    expect(res.from).toBe('offense_1');
  });
});

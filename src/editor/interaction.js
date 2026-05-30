/**
 * Interaction Manager — Drag, snap, click, line drawing handlers on the SVG court.
 */

import { resolveEntityPositions, entityKey } from '../court/renderer.js';
import { findSnapPosition, resolveCoordinate } from '../court/positions.js';

/** Shortest distance from point p to line segment a–b (in pixels). */
function distToSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = a.x + t * dx, cy = a.y + t * dy;
  return Math.hypot(p.x - cx, p.y - cy);
}

export class InteractionManager {
  constructor(svgElement, editorState, getTransform) {
    this.svg = svgElement;
    this.state = editorState;
    this.getTransform = getTransform; // () => transform object
    this.dragging = null; // { key, startX, startY, offsetX, offsetY }
    this.snapIndicator = null;

    this._bindEvents();
  }

  _bindEvents() {
    // Pointer events cover mouse, touch and pen with one code path, so dragging
    // works on phones/tablets as well as desktop.
    this.svg.addEventListener('pointerdown', (e) => this._onPointerDown(e));
    this.svg.addEventListener('pointermove', (e) => this._onPointerMove(e));
    this.svg.addEventListener('pointerup', (e) => this._onPointerUp(e));
    this.svg.addEventListener('pointercancel', (e) => this._onPointerUp(e));
    this.svg.addEventListener('click', (e) => this._onClick(e));
    this.svg.addEventListener('dblclick', (e) => this._onDoubleClick(e));
    this.svg.addEventListener('contextmenu', (e) => this._onContextMenu(e));

    // Drop from palette
    this.svg.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    this.svg.addEventListener('drop', (e) => this._onDrop(e));

    // Keyboard
    document.addEventListener('keydown', (e) => this._onKeyDown(e));
  }

  /**
   * Convert a pointer/mouse event to viewBox coordinates. Uses the SVG's screen
   * CTM so it is correct at any rendered size — the SVG is scaled to 100% width,
   * so on small screens client pixels do NOT equal viewBox units.
   */
  _svgPoint(e) {
    const ctm = this.svg.getScreenCTM && this.svg.getScreenCTM();
    if (ctm) {
      const pt = this.svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const local = pt.matrixTransform(ctm.inverse());
      return { x: local.x, y: local.y };
    }
    // Fallback: assume 1:1 mapping (only correct when rendered at viewBox size).
    const rect = this.svg.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  _courtPoint(e) {
    const t = this.getTransform();
    if (!t) return null;
    const svgPt = this._svgPoint(e);
    return t.toCourt(svgPt.x, svgPt.y);
  }

  /**
   * Find which entity is at a given position (in viewBox units).
   * The radius is in viewBox units; since the court is scaled to fit, a touch
   * needs a much larger radius than a mouse to be comfortable on a phone.
   */
  _hitTestEntity(svgX, svgY, radius = 22) {
    const t = this.getTransform();
    if (!t) return null;
    const positions = resolveEntityPositions(this.state.doc, this.state.currentFrameIndex);
    let closest = null;
    let closestDist = radius;

    for (const [key, pos] of positions) {
      const eSvg = t.toSvg(pos.x, pos.y);
      const dx = eSvg.x - svgX;
      const dy = eSvg.y - svgY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < closestDist) {
        closestDist = dist;
        closest = key;
      }
    }
    return closest;
  }

  /** Find which line (in the current frame) is at a given SVG position. */
  _hitTestLine(svgX, svgY) {
    const t = this.getTransform();
    if (!t) return null;
    const frame = this.state.doc.frames[this.state.currentFrameIndex];
    if (!frame || !frame.lines) return null;
    const ruleset = this.state.doc.court?.ruleset || 'fiba';
    const customPos = this.state.doc.named_positions?.custom || {};
    const threshold = 8; // hit distance in pixels
    let best = null;
    let bestDist = threshold;

    for (let i = 0; i < frame.lines.length; i++) {
      const pts = (frame.lines[i].coords || []).map(c => {
        const abs = resolveCoordinate(c, ruleset, customPos);
        return t.toSvg(abs.x, abs.y);
      });
      for (let s = 0; s + 1 < pts.length; s++) {
        const d = distToSegment({ x: svgX, y: svgY }, pts[s], pts[s + 1]);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
    }
    return best;
  }

  /** Generous hit radius (viewBox units) for coarse pointers (finger) vs mouse. */
  _hitRadius(e) {
    return e && e.pointerType === 'touch' ? 42 : 22;
  }

  _onPointerDown(e) {
    if (e.button !== 0) return;
    if (this.state.activeTool !== 'select') return;

    const svgPt = this._svgPoint(e);
    const hitKey = this._hitTestEntity(svgPt.x, svgPt.y, this._hitRadius(e));

    if (hitKey) {
      const t = this.getTransform();
      const positions = resolveEntityPositions(this.state.doc, this.state.currentFrameIndex);
      const pos = positions.get(hitKey);
      if (pos && t) {
        const eSvg = t.toSvg(pos.x, pos.y);
        this.dragging = {
          key: hitKey,
          offsetX: svgPt.x - eSvg.x,
          offsetY: svgPt.y - eSvg.y,
          hasMoved: false,
        };
        // Capture so the drag keeps tracking even if the finger/cursor leaves
        // the entity (or the SVG re-renders under it).
        try { this.svg.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        this.state.saveUndo();
        this.state.select(hitKey);
        e.preventDefault();
      }
    }
  }

  _onPointerMove(e) {
    if (!this.dragging) return;
    const svgPt = this._svgPoint(e);
    const t = this.getTransform();
    if (!t) return;

    const courtPt = t.toCourt(
      svgPt.x - this.dragging.offsetX,
      svgPt.y - this.dragging.offsetY,
    );

    // Snap to named positions
    const ruleset = this.state.doc.court?.ruleset || 'fiba';
    const customPos = this.state.doc.named_positions?.custom || {};
    const snap = findSnapPosition(courtPt.x, courtPt.y, ruleset, customPos);

    if (snap) {
      this.state.moveEntity(this.dragging.key, snap.x, snap.y);
      this._showSnapIndicator(snap);
    } else {
      this.state.moveEntity(this.dragging.key, courtPt.x, courtPt.y);
      this._hideSnapIndicator();
    }
    this.dragging.hasMoved = true;
    e.preventDefault();
  }

  _onPointerUp(e) {
    if (this.dragging) {
      this._dragMoved = this.dragging.hasMoved;
      this._hideSnapIndicator();
      this.dragging = null;
      try { this.svg.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    }
  }

  _onClick(e) {
    const tool = this.state.activeTool;

    // A click is synthesized after a drag (pointerup). If the drag actually
    // moved the entity, swallow this click so it does not re-run hit testing
    // (which could deselect after the token has moved away from the tap point).
    if (this._dragMoved) {
      this._dragMoved = false;
      return;
    }

    // Line drawing mode
    if (tool.startsWith('line_')) {
      const courtPt = this._courtPoint(e);
      if (!courtPt) return;

      // Snap to nearby entity
      const svgPt = this._svgPoint(e);
      const nearEntity = this._hitTestEntity(svgPt.x, svgPt.y);
      let pt = { x: Math.round(courtPt.x * 100) / 100, y: Math.round(courtPt.y * 100) / 100 };
      if (nearEntity) {
        const positions = resolveEntityPositions(this.state.doc, this.state.currentFrameIndex);
        const ePos = positions.get(nearEntity);
        if (ePos) pt = { x: ePos.x, y: ePos.y };
      }

      this.state.lineWaypoints.push(pt);

      // Track from/to entity for first and last points
      if (this.state.lineWaypoints.length === 1 && nearEntity) {
        this.state._lineFromEntity = nearEntity;
      }
      this.state._lineToEntity = nearEntity || undefined;

      this.state.notify('line-drawing');
      return;
    }

    // Select mode: click to select
    if (tool === 'select') {
      const svgPt = this._svgPoint(e);
      const hitKey = this._hitTestEntity(svgPt.x, svgPt.y);
      if (hitKey) {
        this.state.select(hitKey);
        return;
      }
      // No entity hit — try lines, otherwise deselect.
      const lineIdx = this._hitTestLine(svgPt.x, svgPt.y);
      if (lineIdx !== null) {
        this.state.selectLine(lineIdx);
      } else if (!this.dragging || !this.dragging?.hasMoved) {
        this.state.deselect();
      }
    }
  }

  _onDoubleClick(e) {
    const tool = this.state.activeTool;

    // Finish line drawing
    if (tool.startsWith('line_') && this.state.lineWaypoints.length >= 2) {
      const lineType = tool.replace('line_', '');
      const coords = this.state.lineWaypoints.map(p => ({ x: p.x, y: p.y }));

      const line = { type: lineType, coords };
      if (this.state._lineFromEntity) line.from_entity = this.state._lineFromEntity;
      if (this.state._lineToEntity) line.to_entity = this.state._lineToEntity;

      this.state.addLine(line);
      this.state.lineWaypoints = [];
      this.state._lineFromEntity = undefined;
      this.state._lineToEntity = undefined;
      this.state.notify('line-complete');
    }
  }

  _onContextMenu(e) {
    // Suppress the browser menu and instead select the entity so the
    // floating action menu (with its Delete button) appears. Right-click no
    // longer deletes immediately, which was surprising and destructive.
    e.preventDefault();
    const svgPt = this._svgPoint(e);
    const hitKey = this._hitTestEntity(svgPt.x, svgPt.y);
    if (hitKey) {
      this.state.select(hitKey);
    }
  }

  _onDrop(e) {
    e.preventDefault();
    const entityType = e.dataTransfer.getData('application/ocf-entity');
    if (!entityType) return;

    const courtPt = this._courtPoint(e);
    if (!courtPt) return;

    const x = Math.round(courtPt.x * 100) / 100;
    const y = Math.round(courtPt.y * 100) / 100;

    let entity;
    switch (entityType) {
      case 'offense':
        entity = { type: 'offense', nr: this.state.nextEntityNr('offense'), x, y };
        break;
      case 'defense':
        entity = { type: 'defense', nr: this.state.nextEntityNr('defense'), x, y };
        break;
      case 'ball':
        entity = { type: 'ball', x, y };
        break;
      case 'coach':
        entity = { type: 'coach', x, y };
        break;
      case 'cone':
        entity = { type: 'cone', nr: this.state.nextEntityNr('cone'), x, y };
        break;
      case 'station':
        entity = { type: 'station', nr: this.state.nextEntityNr('station'), x, y };
        break;
    }
    // nextEntityNr returns null when the numbered slots are exhausted.
    if (entity && entity.nr !== null) this.state.addEntity(entity);
  }

  _onKeyDown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    // Delete selected entity
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.state.selectedEntityKey) {
      e.preventDefault();
      this.state.removeEntity(this.state.selectedEntityKey);
    }

    // Delete selected line
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.state.selectedLineIndex !== null) {
      e.preventDefault();
      this.state.removeLine(this.state.selectedLineIndex);
    }

    // Undo/Redo
    if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) this.state.redo();
      else this.state.undo();
    }

    // Enter: confirm line drawing (same as clicking ✓ button)
    if (e.key === 'Enter' && this.state.activeTool.startsWith('line_') && this.state.lineWaypoints.length >= 2) {
      e.preventDefault();
      document.getElementById('btn-draw-confirm')?.click();
    }

    // Escape: cancel line drawing or deselect
    if (e.key === 'Escape') {
      if (this.state.lineWaypoints.length > 0) {
        this.state.lineWaypoints = [];
        this.state._lineFromEntity = undefined;
        this.state._lineToEntity = undefined;
        this.state.setTool('select');
        this.state.notify('line-cancel');
      } else {
        this.state.deselect();
        this.state.setTool('select');
      }
    }
  }

  _showSnapIndicator(snap) {
    const t = this.getTransform();
    if (!t) return;
    const svgPt = t.toSvg(snap.x, snap.y);

    if (!this.snapIndicator) {
      this.snapIndicator = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      this.snapIndicator.setAttribute('r', '6');
      this.snapIndicator.setAttribute('fill', 'none');
      this.snapIndicator.setAttribute('stroke', '#00cc66');
      this.snapIndicator.setAttribute('stroke-width', '2');
      this.snapIndicator.setAttribute('stroke-dasharray', '3,2');
      this.snapIndicator.setAttribute('pointer-events', 'none');
    }
    // renderEditor() resets svg.innerHTML on every move, detaching the
    // indicator — re-append it whenever it is not currently in the DOM.
    if (!this.snapIndicator.isConnected) {
      this.svg.appendChild(this.snapIndicator);
    }
    this.snapIndicator.setAttribute('cx', svgPt.x);
    this.snapIndicator.setAttribute('cy', svgPt.y);
    this.snapIndicator.style.display = '';
  }

  _hideSnapIndicator() {
    if (this.snapIndicator) this.snapIndicator.style.display = 'none';
  }
}

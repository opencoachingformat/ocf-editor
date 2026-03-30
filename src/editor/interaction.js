/**
 * Interaction Manager — Drag, snap, click, line drawing handlers on the SVG court.
 */

import { resolveEntityPositions, entityKey } from '../court/renderer.js';
import { findSnapPosition } from '../court/positions.js';

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
    this.svg.addEventListener('mousedown', (e) => this._onMouseDown(e));
    this.svg.addEventListener('mousemove', (e) => this._onMouseMove(e));
    this.svg.addEventListener('mouseup', (e) => this._onMouseUp(e));
    this.svg.addEventListener('click', (e) => this._onClick(e));
    this.svg.addEventListener('dblclick', (e) => this._onDoubleClick(e));
    this.svg.addEventListener('contextmenu', (e) => this._onContextMenu(e));

    // Drop from palette
    this.svg.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    this.svg.addEventListener('drop', (e) => this._onDrop(e));

    // Keyboard
    document.addEventListener('keydown', (e) => this._onKeyDown(e));
  }

  _svgPoint(e) {
    const rect = this.svg.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  _courtPoint(e) {
    const t = this.getTransform();
    if (!t) return null;
    const svgPt = this._svgPoint(e);
    return t.toCourt(svgPt.x, svgPt.y);
  }

  /** Find which entity is at a given SVG position. */
  _hitTestEntity(svgX, svgY) {
    const t = this.getTransform();
    if (!t) return null;
    const positions = resolveEntityPositions(this.state.doc, this.state.currentFrameIndex);
    let closest = null;
    let closestDist = 15; // hit radius in pixels

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

  _onMouseDown(e) {
    if (e.button !== 0) return;
    if (this.state.activeTool !== 'select') return;

    const svgPt = this._svgPoint(e);
    const hitKey = this._hitTestEntity(svgPt.x, svgPt.y);

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
        this.state.saveUndo();
        this.state.select(hitKey);
        e.preventDefault();
      }
    }
  }

  _onMouseMove(e) {
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
  }

  _onMouseUp(e) {
    if (this.dragging) {
      this._hideSnapIndicator();
      this.dragging = null;
    }
  }

  _onClick(e) {
    const tool = this.state.activeTool;

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
      } else if (!this.dragging || !this.dragging?.hasMoved) {
        // Check if we clicked a line (approximate)
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
    e.preventDefault();
    const svgPt = this._svgPoint(e);
    const hitKey = this._hitTestEntity(svgPt.x, svgPt.y);
    if (hitKey) {
      this.state.removeEntity(hitKey);
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
    if (entity) this.state.addEntity(entity);
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

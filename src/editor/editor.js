/**
 * Editor State Management.
 * Central state store for the OCF editor with undo/redo support.
 */

import { createBlankDocument } from '../schema.js';
import { entityKey } from '../court/renderer.js';

const MAX_UNDO = 30;

export class EditorState {
  constructor(options = {}) {
    this.doc = createBlankDocument(options);
    this.selectedEntityKey = null;
    this.selectedLineIndex = null; // { frameIndex, lineIndex }
    this.currentFrameIndex = 0;
    this.activeTool = 'select'; // 'select' | 'line_movement' | 'line_passing' | etc.
    this.lineWaypoints = []; // in-progress line waypoints
    this.undoStack = [];
    this.redoStack = [];
    this.listeners = new Set();
  }

  /** Subscribe to state changes. Returns unsubscribe function. */
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Notify all listeners. */
  notify(reason) {
    for (const fn of this.listeners) fn(reason || 'update');
  }

  /** Save current state for undo. */
  saveUndo() {
    this.undoStack.push(JSON.stringify(this.doc));
    if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
    this.redoStack = [];
  }

  /** Undo last action. */
  undo() {
    if (this.undoStack.length === 0) return;
    this.redoStack.push(JSON.stringify(this.doc));
    this.doc = JSON.parse(this.undoStack.pop());
    this.selectedEntityKey = null;
    this.selectedLineIndex = null;
    this.notify('undo');
  }

  /** Redo last undone action. */
  redo() {
    if (this.redoStack.length === 0) return;
    this.undoStack.push(JSON.stringify(this.doc));
    this.doc = JSON.parse(this.redoStack.pop());
    this.selectedEntityKey = null;
    this.selectedLineIndex = null;
    this.notify('redo');
  }

  /** Load a document into the editor. */
  loadDocument(doc) {
    this.saveUndo();
    this.doc = JSON.parse(JSON.stringify(doc));
    this.selectedEntityKey = null;
    this.selectedLineIndex = null;
    this.currentFrameIndex = 0;
    this.notify('load');
  }

  /** Update meta fields. */
  updateMeta(fields) {
    this.saveUndo();
    Object.assign(this.doc.meta, fields);
    this.doc.meta.modified = new Date().toISOString();
    this.notify('meta');
  }

  /** Update court settings. */
  updateCourt(fields) {
    this.saveUndo();
    Object.assign(this.doc.court, fields);
    this.notify('court');
  }

  // --- Entity Operations ---

  /** Add an entity to the document. */
  addEntity(entity) {
    this.saveUndo();
    // Remove existing entity with same key if it exists
    const key = entityKey(entity);
    this.doc.entities = this.doc.entities.filter(e => entityKey(e) !== key);
    this.doc.entities.push(entity);
    this.selectedEntityKey = key;
    this.notify('entity-add');
  }

  /** Move an entity (updates base position or frame entity_state). */
  moveEntity(key, x, y) {
    // If we're on frame 0, update base entity position
    // Otherwise update entity_states in current frame
    if (this.currentFrameIndex === 0) {
      const entity = this.doc.entities.find(e => entityKey(e) === key);
      if (entity) {
        entity.x = Math.round(x * 100) / 100;
        entity.y = Math.round(y * 100) / 100;
      }
    } else {
      const frame = this.doc.frames[this.currentFrameIndex];
      if (frame) {
        if (!frame.entity_states) frame.entity_states = {};
        frame.entity_states[key] = {
          x: Math.round(x * 100) / 100,
          y: Math.round(y * 100) / 100,
        };
      }
    }
    this.notify('entity-move');
  }

  /** Remove an entity. */
  removeEntity(key) {
    this.saveUndo();
    this.doc.entities = this.doc.entities.filter(e => entityKey(e) !== key);
    // Also remove from all frame entity_states
    for (const frame of this.doc.frames) {
      if (frame.entity_states) delete frame.entity_states[key];
    }
    if (this.selectedEntityKey === key) this.selectedEntityKey = null;
    this.notify('entity-remove');
  }

  /** Update entity properties (color, rotation, label). */
  updateEntity(key, fields) {
    this.saveUndo();
    const entity = this.doc.entities.find(e => entityKey(e) === key);
    if (entity) {
      Object.assign(entity, fields);
      this.notify('entity-update');
    }
  }

  /** Get next available number for a given entity type. */
  nextEntityNr(type) {
    const existing = this.doc.entities.filter(e => e.type === type).map(e => e.nr || 0);
    for (let i = 1; i <= 99; i++) {
      if (!existing.includes(i)) return i;
    }
    return existing.length + 1;
  }

  // --- Line Operations ---

  /** Add a line to the current frame. */
  addLine(line) {
    this.saveUndo();
    const frame = this.doc.frames[this.currentFrameIndex];
    if (frame) {
      frame.lines.push(line);
      this.notify('line-add');
    }
  }

  /** Remove a line from the current frame. */
  removeLine(lineIndex) {
    this.saveUndo();
    const frame = this.doc.frames[this.currentFrameIndex];
    if (frame && frame.lines[lineIndex]) {
      frame.lines.splice(lineIndex, 1);
      this.selectedLineIndex = null;
      this.notify('line-remove');
    }
  }

  /** Update a line's properties. */
  updateLine(lineIndex, fields) {
    this.saveUndo();
    const frame = this.doc.frames[this.currentFrameIndex];
    if (frame && frame.lines[lineIndex]) {
      Object.assign(frame.lines[lineIndex], fields);
      this.notify('line-update');
    }
  }

  // --- Frame Operations ---

  /** Add a new frame. */
  addFrame() {
    this.saveUndo();
    const id = `frame_${this.doc.frames.length + 1}`;
    this.doc.frames.push({
      id,
      label: `Step ${this.doc.frames.length + 1}`,
      lines: [],
    });
    this.currentFrameIndex = this.doc.frames.length - 1;
    this.notify('frame-add');
  }

  /** Remove a frame (minimum 1 frame). */
  removeFrame(index) {
    if (this.doc.frames.length <= 1) return;
    this.saveUndo();
    this.doc.frames.splice(index, 1);
    if (this.currentFrameIndex >= this.doc.frames.length) {
      this.currentFrameIndex = this.doc.frames.length - 1;
    }
    this.notify('frame-remove');
  }

  /** Update frame label/description. */
  updateFrame(index, fields) {
    this.saveUndo();
    const frame = this.doc.frames[index];
    if (frame) {
      Object.assign(frame, fields);
      this.notify('frame-update');
    }
  }

  /** Set current frame. */
  setCurrentFrame(index) {
    this.currentFrameIndex = Math.max(0, Math.min(index, this.doc.frames.length - 1));
    this.selectedEntityKey = null;
    this.selectedLineIndex = null;
    this.notify('frame-select');
  }

  // --- Area / Label Operations ---

  addArea(area) {
    this.saveUndo();
    if (!this.doc.areas) this.doc.areas = [];
    this.doc.areas.push(area);
    this.notify('area-add');
  }

  removeArea(index) {
    this.saveUndo();
    if (this.doc.areas) this.doc.areas.splice(index, 1);
    this.notify('area-remove');
  }

  addLabel(label) {
    this.saveUndo();
    if (!this.doc.labels) this.doc.labels = [];
    this.doc.labels.push(label);
    this.notify('label-add');
  }

  removeLabel(index) {
    this.saveUndo();
    if (this.doc.labels) this.doc.labels.splice(index, 1);
    this.notify('label-remove');
  }

  // --- Tool State ---

  setTool(tool) {
    this.activeTool = tool;
    this.lineWaypoints = [];
    this.notify('tool');
  }

  select(entityKey) {
    this.selectedEntityKey = entityKey;
    this.selectedLineIndex = null;
    this.notify('select');
  }

  selectLine(lineIndex) {
    this.selectedLineIndex = lineIndex;
    this.selectedEntityKey = null;
    this.notify('select-line');
  }

  deselect() {
    this.selectedEntityKey = null;
    this.selectedLineIndex = null;
    this.notify('deselect');
  }
}

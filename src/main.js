/**
 * OCF Editor & Viewer — Main Entry Point.
 * Ties together all modules into the application.
 */

import { renderOCF, resolveEntityPositions, entityKey } from './court/renderer.js';
import { createTransform } from './court/court-svg.js';
import { straightPath } from './court/curves.js';
import { FramePlayer } from './player/player.js';
import { EditorState } from './editor/editor.js';
import { Palette } from './editor/palette.js';
import { Toolbar } from './editor/toolbar.js';
import { ContextMenu } from './editor/context-menu.js';
import { PropertiesPanel } from './editor/properties.js';
import { FramesPanel } from './editor/frames.js';
import { InteractionManager } from './editor/interaction.js';
import { exportJSON, importJSON, toJSONString } from './export/json.js';

// --- App State ---
let currentMode = 'editor'; // 'editor' | 'viewer'
let currentTransform = null;

// --- Editor State ---
const editorState = new EditorState({ ruleset: 'fiba', courtType: 'half_court', drillFocus: 'offense' });

// --- Frame Player ---
const player = new FramePlayer({
  onFrameChange: (idx) => {
    if (currentMode === 'viewer') renderViewer();
    updatePlayerControls();
  },
  onPlayStateChange: (playing) => updatePlayerControls(),
});

// --- DOM References ---
let svgEl, svgContainer;
let paletteEl, toolbarEl, propertiesEl, framesEl;
let jsonPanel, jsonTextarea;
let playerControlsEl;
let modeToggle;

// --- Initialize ---
export function init() {
  svgContainer = document.getElementById('svg-container');
  svgEl = document.getElementById('court-svg');
  paletteEl = document.getElementById('palette');
  toolbarEl = document.getElementById('toolbar');
  propertiesEl = document.getElementById('properties');
  framesEl = document.getElementById('frames');
  jsonPanel = document.getElementById('json-panel');
  jsonTextarea = document.getElementById('json-textarea');
  playerControlsEl = document.getElementById('player-controls');
  modeToggle = document.getElementById('mode-toggle');

  // Init UI components
  new Palette(paletteEl, editorState);
  new Toolbar(toolbarEl, editorState);
  new PropertiesPanel(propertiesEl, editorState);
  new FramesPanel(framesEl, editorState);

  // Init interaction manager
  const getTransform = () => currentTransform;
  new InteractionManager(svgEl, editorState, getTransform);

  // Init context menu (floats above the court, shown on entity selection)
  new ContextMenu(svgContainer, editorState, getTransform, resolveEntityPositions);

  // Subscribe to editor state changes → re-render
  editorState.subscribe((reason) => {
    renderEditor();
    updateJSON();
    updateDrawConfirm();
  });

  // Mode toggle
  modeToggle.addEventListener('click', toggleMode);

  // Export/Import buttons
  document.getElementById('btn-export').addEventListener('click', () => {
    const result = exportJSON(editorState.doc);
    if (!result.success) {
      showToast('Validation errors:\n' + result.errors.join('\n'), 'error');
    } else {
      showToast('Exported successfully!', 'success');
    }
  });

  document.getElementById('btn-import').addEventListener('click', async () => {
    const result = await importJSON();
    if (result.errors) {
      showToast('Import errors:\n' + result.errors.join('\n'), 'error');
    } else if (result.doc) {
      editorState.loadDocument(result.doc);
      showToast('Imported successfully!', 'success');
    }
  });

  // Player controls
  document.getElementById('btn-prev').addEventListener('click', () => {
    if (currentMode === 'viewer') {
      player.prev();
    } else {
      const idx = editorState.currentFrameIndex;
      if (idx > 0) editorState.setCurrentFrame(idx - 1);
    }
  });

  document.getElementById('btn-next').addEventListener('click', () => {
    if (currentMode === 'viewer') {
      player.next();
    } else {
      const idx = editorState.currentFrameIndex;
      if (idx < editorState.doc.frames.length - 1) editorState.setCurrentFrame(idx + 1);
    }
  });

  document.getElementById('btn-play').addEventListener('click', () => {
    if (currentMode === 'viewer') player.toggle();
  });

  // Draw confirm / cancel buttons
  document.getElementById('btn-draw-confirm')?.addEventListener('click', () => {
    _commitLine();
  });
  document.getElementById('btn-draw-cancel')?.addEventListener('click', () => {
    editorState.lineWaypoints = [];
    editorState._lineFromEntity = undefined;
    editorState._lineToEntity = undefined;
    editorState.setTool('select');
    editorState.notify('line-cancel');
  });

  // Undo/Redo buttons
  document.getElementById('btn-undo')?.addEventListener('click', () => editorState.undo());
  document.getElementById('btn-redo')?.addEventListener('click', () => editorState.redo());

  // JSON toggle
  document.getElementById('btn-json-toggle')?.addEventListener('click', () => {
    jsonPanel.classList.toggle('hidden');
    updateJSON();
  });

  // Load example drill if URL has ?example=...
  const params = new URLSearchParams(window.location.search);
  const example = params.get('example');
  if (example) {
    loadExample(example);
  }

  // Initial render
  resizeSVG();
  renderEditor();
  updateJSON();

  // viewBox-based scaling — no resize recalculation needed.
}

const CANVAS_W = 700;

function resizeSVG() {
  // No-op: SVG uses viewBox + CSS width/height:100% for responsive scaling.
}

function canvasHeight(doc) {
  // Mirror the padding logic from createTransform so viewBox fits exactly.
  const ruleset = doc?.court?.ruleset || 'fiba';
  const courtType = doc?.court?.type || 'half_court';
  // Court dimensions
  const dimMap = { fiba:{hw:7.5,hl:14.0,unit:'m'}, nba:{hw:25,hl:47,unit:'ft'}, ncaa:{hw:25,hl:47,unit:'ft'}, nfhs:{hw:25,hl:42,unit:'ft'} };
  const ccMap  = { fiba:1.8, nba:6, ncaa:6, nfhs:6 };
  const dim = dimMap[ruleset] || dimMap.fiba;
  const padSmall = dim.unit === 'm' ? 1.0 : 3.5;
  const ccR = ccMap[ruleset] ?? padSmall;
  const courtH = courtType === 'full_court' ? dim.hl * 2 : dim.hl;
  const padBottom = courtType === 'half_court' ? ccR + padSmall : padSmall;
  const totalW = dim.hw * 2 + padSmall * 2;
  const totalH = courtH + padSmall + padBottom;
  return Math.round(CANVAS_W * totalH / totalW);
}

// --- Render ---

function renderEditor() {
  const w = CANVAS_W;
  const h = canvasHeight(editorState.doc);
  svgEl.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  const { svgContent, transform } = renderOCF(editorState.doc, editorState.currentFrameIndex, w, h);
  currentTransform = transform;

  // Build additional overlays for editor
  let overlay = '';

  // Selection indicator
  if (editorState.selectedEntityKey) {
    const positions = resolveEntityPositions(editorState.doc, editorState.currentFrameIndex);
    const pos = positions.get(editorState.selectedEntityKey);
    if (pos && transform) {
      const svgPos = transform.toSvg(pos.x, pos.y);
      overlay += `<circle cx="${svgPos.x}" cy="${svgPos.y}" r="18" fill="none" stroke="#00aaff" stroke-width="2" stroke-dasharray="4,3" pointer-events="none"/>`;
    }
  }

  // Line drawing preview
  if (editorState.lineWaypoints.length > 0 && transform) {
    const pts = editorState.lineWaypoints.map(p => transform.toSvg(p.x, p.y));
    if (pts.length >= 1) {
      const pathD = straightPath(pts);
      if (pathD) {
        overlay += `<path d="${pathD}" fill="none" stroke="#00aaff" stroke-width="2" stroke-dasharray="5,3" pointer-events="none"/>`;
      }
      // Waypoint dots
      for (const pt of pts) {
        overlay += `<circle cx="${pt.x}" cy="${pt.y}" r="4" fill="#00aaff" pointer-events="none"/>`;
      }
    }
  }

  svgEl.innerHTML = svgContent + overlay;

  // Update frame indicator
  updatePlayerControls();
}

function renderViewer() {
  const doc = player.doc || editorState.doc;
  const w = CANVAS_W;
  const h = canvasHeight(doc);
  svgEl.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  const { svgContent, transform } = renderOCF(doc, player.currentFrame, w, h);
  currentTransform = transform;
  svgEl.innerHTML = svgContent;
  updatePlayerControls();
}

function updatePlayerControls() {
  const doc = currentMode === 'viewer' ? (player.doc || editorState.doc) : editorState.doc;
  const idx = currentMode === 'viewer' ? player.currentFrame : editorState.currentFrameIndex;
  const total = doc.frames?.length || 1;
  const frame = doc.frames?.[idx];

  const labelEl = document.getElementById('frame-label');
  const counterEl = document.getElementById('frame-counter');
  const descEl = document.getElementById('frame-desc');
  const playBtn = document.getElementById('btn-play');

  if (labelEl) labelEl.textContent = frame?.label || `Step ${idx + 1}`;
  if (counterEl) counterEl.textContent = `${idx + 1} / ${total}`;
  if (descEl) descEl.textContent = frame?.description || '';
  if (playBtn) {
    playBtn.textContent = player.isPlaying ? '⏸' : '▶';
    playBtn.style.display = currentMode === 'viewer' ? '' : 'none';
  }
}

function updateJSON() {
  if (jsonTextarea && !jsonPanel.classList.contains('hidden')) {
    jsonTextarea.value = toJSONString(editorState.doc);
  }
}

function toggleMode() {
  if (currentMode === 'editor') {
    currentMode = 'viewer';
    player.load(JSON.parse(JSON.stringify(editorState.doc)));
    document.body.classList.add('viewer-mode');
    document.body.classList.remove('editor-mode');
    modeToggle.textContent = 'Switch to Editor';
    renderViewer();
  } else {
    currentMode = 'editor';
    player.stop();
    document.body.classList.remove('viewer-mode');
    document.body.classList.add('editor-mode');
    modeToggle.textContent = 'Switch to Viewer';
    renderEditor();
  }
}

async function loadExample(name) {
  try {
    const resp = await fetch(`examples/${name}.ocf.json`);
    if (resp.ok) {
      const doc = await resp.json();
      editorState.loadDocument(doc);
      showToast(`Loaded: ${doc.meta.title}`, 'success');
    }
  } catch (e) {
    console.warn('Could not load example:', e);
  }
}

/** Show/hide the draw-confirm bar based on whether line waypoints are active. */
function updateDrawConfirm() {
  const isDrawing = currentMode === 'editor' && editorState.lineWaypoints?.length > 0;
  const bar = document.getElementById('draw-confirm-bar');
  if (bar) bar.classList.toggle('hidden', !isDrawing);

  // Also show/hide normal player nav
  const nav = document.getElementById('player-nav');
  if (nav) nav.classList.toggle('hidden', isDrawing);
}

/** Commit the current line waypoints as a line in the document. */
function _commitLine() {
  const tool = editorState.activeTool;
  if (!tool.startsWith('line_') || editorState.lineWaypoints.length < 2) return;

  const lineType = tool.replace('line_', '');
  const coords = editorState.lineWaypoints.map(p => ({ x: p.x, y: p.y }));
  const line = { type: lineType, coords };
  if (editorState._lineFromEntity) line.from_entity = editorState._lineFromEntity;
  if (editorState._lineToEntity)   line.to_entity   = editorState._lineToEntity;

  editorState.addLine(line);
  editorState.lineWaypoints = [];
  editorState._lineFromEntity = undefined;
  editorState._lineToEntity = undefined;
  editorState.setTool('select');
  editorState.notify('line-complete');
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Auto-init on DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

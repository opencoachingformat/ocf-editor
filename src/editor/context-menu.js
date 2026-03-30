/**
 * ContextMenu — Floating action menu that appears when an entity is selected.
 *
 * Workflow:
 *  1. Player is clicked → selected → this menu appears above the player token
 *  2. User picks a draw action → tool is set, menu hides, drawing starts
 *  3. User clicks endpoint → line is previewed
 *  4. User confirms (Enter / ✓ button) or cancels (Escape / ✗ button)
 */

const TOOLS = [
  { id: 'line_movement',  label: 'Move',    icon: '↗', title: 'Movement (1)' },
  { id: 'line_passing',   label: 'Pass',    icon: '⇢', title: 'Pass (2)' },
  { id: 'line_dribbling', label: 'Dribble', icon: '〜', title: 'Dribble (3)' },
  { id: 'line_screen',    label: 'Screen',  icon: '⊣', title: 'Screen (4)' },
  { id: 'line_line',      label: 'Line',    icon: '—', title: 'Line (5)' },
];

function makeEl(tag, classes = [], attrs = {}) {
  const el = document.createElement(tag);
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function makeText(text) {
  return document.createTextNode(text);
}

export class ContextMenu {
  constructor(svgContainer, editorState, getTransform, resolvePositionsFn) {
    this.container = svgContainer;
    this.state = editorState;
    this.getTransform = getTransform;
    this.resolvePositions = resolvePositionsFn;
    this.menu = null;
    this._ballBtn = null;
    this._build();
    this.state.subscribe(() => this._onStateChange());
  }

  _build() {
    this.menu = makeEl('div', ['ctx-menu', 'hidden'], {
      role: 'toolbar',
      'aria-label': 'Player actions',
    });

    // Draw tool buttons
    const toolGroup = makeEl('div', ['ctx-group']);
    for (const tool of TOOLS) {
      const btn = makeEl('button', ['ctx-btn'], { title: tool.title, 'data-tool': tool.id });
      const icon = makeEl('span', ['ctx-icon']);
      icon.textContent = tool.icon;
      const label = makeEl('span', ['ctx-label']);
      label.textContent = tool.label;
      btn.appendChild(icon);
      btn.appendChild(label);
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.state.setTool(tool.id);
        this._hide();
      });
      toolGroup.appendChild(btn);
    }

    // Separator
    const sep = makeEl('div', ['ctx-sep']);

    // Ball toggle
    this._ballBtn = makeEl('button', ['ctx-btn', 'ctx-btn-ball'], {
      title: 'Toggle ball possession',
      id: 'ctx-btn-ball',
    });
    const ballIcon = makeEl('span', ['ctx-icon']);
    ballIcon.textContent = '🏀';
    const ballLabel = makeEl('span', ['ctx-label']);
    ballLabel.textContent = 'Ball';
    this._ballBtn.appendChild(ballIcon);
    this._ballBtn.appendChild(ballLabel);
    this._ballBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._toggleBall();
    });

    // Delete button
    const delBtn = makeEl('button', ['ctx-btn', 'ctx-btn-delete'], { title: 'Delete (Del)' });
    const delIcon = makeEl('span', ['ctx-icon']);
    delIcon.textContent = '✕';
    delBtn.appendChild(delIcon);
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.state.selectedEntityKey) {
        this.state.removeEntity(this.state.selectedEntityKey);
      }
      this._hide();
    });

    this.menu.appendChild(toolGroup);
    this.menu.appendChild(sep);
    this.menu.appendChild(this._ballBtn);
    this.menu.appendChild(delBtn);

    this.container.appendChild(this.menu);

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!this.menu.contains(e.target)) this._hide();
    });
  }

  _onStateChange() {
    const key = this.state.selectedEntityKey;
    const isDrawing = this.state.lineWaypoints?.length > 0;
    const tool = this.state.activeTool;

    if (isDrawing || tool !== 'select') {
      this._hide();
      return;
    }

    if (key) {
      this._show(key);
    } else {
      this._hide();
    }
  }

  _show(entityKey) {
    const t = this.getTransform();
    if (!t) return;

    const positions = this.resolvePositions(this.state.doc, this.state.currentFrameIndex);
    const pos = positions.get(entityKey);
    if (!pos) return;

    const svgPos = t.toSvg(pos.x, pos.y);

    // Force layout for accurate width
    this.menu.classList.remove('hidden');
    const menuW = this.menu.offsetWidth || 260;
    const containerW = this.container.offsetWidth;

    let left = svgPos.x - menuW / 2;
    left = Math.max(8, Math.min(left, containerW - menuW - 8));

    const PLAYER_RADIUS_PX = 18;
    let top = svgPos.y - PLAYER_RADIUS_PX - 52;
    top = Math.max(8, top);

    this.menu.style.left = left + 'px';
    this.menu.style.top = top + 'px';

    // Reflect has_ball state
    const entity = this.state.doc.entities?.[entityKey];
    if (this._ballBtn && entity) {
      this._ballBtn.classList.toggle('active', !!entity.has_ball);
    }
  }

  _hide() {
    this.menu.classList.add('hidden');
  }

  _toggleBall() {
    const key = this.state.selectedEntityKey;
    if (!key) return;
    const entity = this.state.doc.entities?.[key];
    if (!entity) return;

    this.state.saveUndo();
    entity.has_ball = !entity.has_ball;

    // Only one player can have the ball at a time
    if (entity.has_ball) {
      for (const [k, e] of Object.entries(this.state.doc.entities || {})) {
        if (k !== key) e.has_ball = false;
      }
    }

    this.state.notify('has-ball-changed');
  }
}

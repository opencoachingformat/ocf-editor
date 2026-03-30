/**
 * Toolbar — Keyboard shortcuts only.
 * The visual tool selection is handled by the ContextMenu (context-menu.js).
 */

export class Toolbar {
  constructor(container, editorState) {
    this.container = container;
    this.state = editorState;

    // Hide toolbar container — tools are selected via context menu
    if (this.container) this.container.style.display = 'none';

    this._bindKeyboard();
  }

  _bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      const keyMap = {
        'v': 'select',
        '1': 'line_movement',
        '2': 'line_passing',
        '3': 'line_dribbling',
        '4': 'line_screen',
        '5': 'line_line',
      };
      const tool = keyMap[e.key.toLowerCase()];
      if (tool) this.state.setTool(tool);
    });
  }
}

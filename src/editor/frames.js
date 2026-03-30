/**
 * Frame Management UI — Add/remove/select frames, show timeline.
 */

export class FramesPanel {
  constructor(container, editorState) {
    this.container = container;
    this.state = editorState;
    this.state.subscribe(() => this.render());
    this.render();
  }

  render() {
    this.container.innerHTML = '';
    const frames = this.state.doc.frames || [];

    // Header
    const header = el('div', { className: 'frames-header' });
    header.appendChild(el('span', { className: 'frames-title' }, 'Frames'));

    const addBtn = el('button', { className: 'frames-add-btn', title: 'Add Frame' }, '+');
    addBtn.addEventListener('click', () => this.state.addFrame());
    header.appendChild(addBtn);
    this.container.appendChild(header);

    // Frame list
    const list = el('div', { className: 'frames-list' });
    frames.forEach((frame, i) => {
      const item = el('div', { className: `frame-item ${i === this.state.currentFrameIndex ? 'active' : ''}` });

      const label = el('span', { className: 'frame-label' }, frame.label || `Step ${i + 1}`);
      label.addEventListener('click', () => this.state.setCurrentFrame(i));
      item.appendChild(label);

      // Entity states indicator
      const states = frame.entity_states ? Object.keys(frame.entity_states).length : 0;
      const lines = (frame.lines || []).length;
      const info = el('span', { className: 'frame-info' }, `${lines}L ${states}M`);
      item.appendChild(info);

      // Remove button (if more than 1 frame)
      if (frames.length > 1) {
        const rmBtn = el('button', { className: 'frame-rm-btn', title: 'Remove' }, '×');
        rmBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.state.removeFrame(i);
        });
        item.appendChild(rmBtn);
      }

      list.appendChild(item);
    });
    this.container.appendChild(list);

    // Frame label editor
    if (frames[this.state.currentFrameIndex]) {
      const frame = frames[this.state.currentFrameIndex];
      const editSection = el('div', { className: 'frame-edit' });

      const labelInput = el('input', {
        type: 'text',
        className: 'frame-label-input',
        placeholder: 'Frame label',
        value: frame.label || '',
      });
      labelInput.addEventListener('change', () => {
        this.state.updateFrame(this.state.currentFrameIndex, { label: labelInput.value });
      });
      editSection.appendChild(labelInput);

      const descInput = el('textarea', {
        className: 'frame-desc-input',
        placeholder: 'Description...',
        rows: '2',
      });
      descInput.value = frame.description || '';
      descInput.addEventListener('change', () => {
        this.state.updateFrame(this.state.currentFrameIndex, { description: descInput.value });
      });
      editSection.appendChild(descInput);

      this.container.appendChild(editSection);
    }
  }
}

function el(tag, attrs = {}, text) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') e.className = v;
    else e.setAttribute(k, v);
  }
  if (text !== undefined) e.textContent = text;
  return e;
}

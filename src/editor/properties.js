/**
 * Property Panel — Shows/edits properties of selected entity or line.
 */

import { entityKey } from '../court/renderer.js';

export class PropertiesPanel {
  constructor(container, editorState) {
    this.container = container;
    this.state = editorState;
    this.state.subscribe(() => this.render());
    this.render();
  }

  render() {
    this.container.innerHTML = '';

    if (this.state.selectedEntityKey) {
      this.renderEntityProps();
    } else if (this.state.selectedLineIndex !== null) {
      this.renderLineProps();
    } else {
      this.renderMetaProps();
    }
  }

  renderEntityProps() {
    const key = this.state.selectedEntityKey;
    const entity = this.state.doc.entities.find(e => entityKey(e) === key);
    if (!entity) return;

    const title = el('div', { className: 'prop-title' }, `${entity.type.charAt(0).toUpperCase() + entity.type.slice(1)}: ${key}`);
    this.container.appendChild(title);

    // Position display
    this.container.appendChild(el('div', { className: 'prop-row' }, `x: ${entity.x.toFixed(2)}, y: ${entity.y.toFixed(2)}`));

    // Color selector (for offense/defense)
    if (entity.type === 'offense' || entity.type === 'defense') {
      const colorRow = el('div', { className: 'prop-row' });
      colorRow.appendChild(el('label', {}, 'Color: '));
      const colorSelect = el('select', { className: 'prop-input' });
      const colors = ['', 'offense', 'defense', 'black', 'grey', 'yellow', 'green', 'red', 'blue', 'white'];
      for (const c of colors) {
        const opt = el('option', { value: c }, c || '(default)');
        if (entity.color === c || (!entity.color && c === '')) opt.selected = true;
        colorSelect.appendChild(opt);
      }
      colorSelect.addEventListener('change', () => {
        const val = colorSelect.value || undefined;
        this.state.updateEntity(key, { color: val });
      });
      colorRow.appendChild(colorSelect);
      this.container.appendChild(colorRow);

      // Label input
      const labelRow = el('div', { className: 'prop-row' });
      labelRow.appendChild(el('label', {}, 'Label: '));
      const labelInput = el('input', { type: 'text', className: 'prop-input', value: entity.label || '', placeholder: 'Optional label' });
      labelInput.addEventListener('change', () => {
        const val = labelInput.value || undefined;
        this.state.updateEntity(key, { label: val });
      });
      labelRow.appendChild(labelInput);
      this.container.appendChild(labelRow);
    }

    // Delete button
    const delBtn = el('button', { className: 'prop-btn danger' }, 'Delete Entity');
    delBtn.addEventListener('click', () => this.state.removeEntity(key));
    this.container.appendChild(delBtn);
  }

  renderLineProps() {
    const idx = this.state.selectedLineIndex;
    const frame = this.state.doc.frames[this.state.currentFrameIndex];
    if (!frame || !frame.lines[idx]) return;
    const line = frame.lines[idx];

    const title = el('div', { className: 'prop-title' }, `Line: ${line.type}`);
    this.container.appendChild(title);

    // Curved toggle
    const curvedRow = el('div', { className: 'prop-row' });
    const curvedCb = el('input', { type: 'checkbox', id: 'prop-curved' });
    curvedCb.checked = !!line.curved;
    curvedCb.addEventListener('change', () => {
      this.state.updateLine(idx, { curved: curvedCb.checked || undefined });
    });
    curvedRow.appendChild(curvedCb);
    curvedRow.appendChild(el('label', { for: 'prop-curved' }, ' Curved'));
    this.container.appendChild(curvedRow);

    // Color
    const colorRow = el('div', { className: 'prop-row' });
    colorRow.appendChild(el('label', {}, 'Color: '));
    const colorSelect = el('select', { className: 'prop-input' });
    const colors = ['', 'black', 'grey', 'offense', 'defense', 'yellow', 'green', 'red', 'blue', 'white'];
    for (const c of colors) {
      const opt = el('option', { value: c }, c || '(default)');
      if (line.color === c || (!line.color && c === '')) opt.selected = true;
      colorSelect.appendChild(opt);
    }
    colorSelect.addEventListener('change', () => {
      this.state.updateLine(idx, { color: colorSelect.value || undefined });
    });
    colorRow.appendChild(colorSelect);
    this.container.appendChild(colorRow);

    // Delete button
    const delBtn = el('button', { className: 'prop-btn danger' }, 'Delete Line');
    delBtn.addEventListener('click', () => this.state.removeLine(idx));
    this.container.appendChild(delBtn);
  }

  renderMetaProps() {
    const meta = this.state.doc.meta;
    const court = this.state.doc.court;

    const title = el('div', { className: 'prop-title' }, 'Drill Settings');
    this.container.appendChild(title);

    // Title
    this.addTextInput('Title', meta.title, (val) => this.state.updateMeta({ title: val }));

    // Description
    this.addTextInput('Description', meta.description || '', (val) => this.state.updateMeta({ description: val }), true);

    // Author
    this.addTextInput('Author', meta.author || '', (val) => this.state.updateMeta({ author: val }));

    // Difficulty
    this.addSelect('Difficulty', meta.difficulty || 'beginner',
      ['beginner', 'intermediate', 'advanced'],
      (val) => this.state.updateMeta({ difficulty: val }));

    // Ruleset
    this.addSelect('Ruleset', court.ruleset,
      ['fiba', 'nba', 'ncaa', 'nfhs'],
      (val) => this.state.updateCourt({ ruleset: val }));

    // Court type
    this.addSelect('Court', court.type,
      ['half_court', 'full_court'],
      (val) => this.state.updateCourt({ type: val }));

    // Drill focus
    this.addSelect('Focus', court.drill_focus || 'offense',
      ['offense', 'defense', 'transition', 'neutral'],
      (val) => this.state.updateCourt({ drill_focus: val }));

    // Tags
    this.addTextInput('Tags', (meta.tags || []).join(', '), (val) => {
      this.state.updateMeta({ tags: val.split(',').map(t => t.trim()).filter(Boolean) });
    });
  }

  addTextInput(label, value, onChange, multiline = false) {
    const row = el('div', { className: 'prop-row' });
    row.appendChild(el('label', { className: 'prop-label' }, label));
    const input = multiline
      ? el('textarea', { className: 'prop-input', rows: '2' })
      : el('input', { type: 'text', className: 'prop-input' });
    input.value = value;
    input.addEventListener('change', () => onChange(input.value));
    row.appendChild(input);
    this.container.appendChild(row);
  }

  addSelect(label, value, options, onChange) {
    const row = el('div', { className: 'prop-row' });
    row.appendChild(el('label', { className: 'prop-label' }, label));
    const select = el('select', { className: 'prop-input' });
    for (const opt of options) {
      const o = el('option', { value: opt }, opt);
      if (opt === value) o.selected = true;
      select.appendChild(o);
    }
    select.addEventListener('change', () => onChange(select.value));
    row.appendChild(select);
    this.container.appendChild(row);
  }
}

function el(tag, attrs = {}, text) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') e.className = v;
    else if (k === 'for') e.setAttribute('for', v);
    else e.setAttribute(k, v);
  }
  if (text) e.textContent = text;
  return e;
}

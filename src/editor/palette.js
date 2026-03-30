/**
 * Entity Palette UI — Draggable entity buttons.
 */

export class Palette {
  constructor(container, editorState) {
    this.container = container;
    this.state = editorState;
    this.render();
  }

  render() {
    this.container.innerHTML = '';

    const title = el('div', { className: 'palette-title' }, 'Entities');
    this.container.appendChild(title);

    const items = [
      { type: 'offense', label: 'Offense', icon: '●', cls: 'pal-offense' },
      { type: 'defense', label: 'Defense', icon: '◗', cls: 'pal-defense' },
      { type: 'ball', label: 'Ball', icon: '◉', cls: 'pal-ball' },
      { type: 'coach', label: 'Coach', icon: 'C', cls: 'pal-coach' },
      { type: 'cone', label: 'Cone', icon: '△', cls: 'pal-cone' },
      { type: 'station', label: 'Station', icon: '■', cls: 'pal-station' },
    ];

    for (const item of items) {
      const btn = el('button', {
        className: `palette-item ${item.cls}`,
        draggable: true,
        title: `Add ${item.label}`,
      });
      btn.innerHTML = `<span class="pal-icon">${item.icon}</span><span class="pal-label">${item.label}</span>`;

      btn.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('application/ocf-entity', item.type);
        e.dataTransfer.effectAllowed = 'copy';
      });

      // Also support click-to-add at default position
      btn.addEventListener('click', () => {
        this.addEntityAtCenter(item.type);
      });

      this.container.appendChild(btn);
    }
  }

  addEntityAtCenter(type) {
    const ruleset = this.state.doc.court?.ruleset || 'fiba';
    // Default position: top of the key area
    const defaults = { fiba: { x: 0, y: 7 }, nba: { x: 0, y: 23 }, ncaa: { x: 0, y: 23 }, nfhs: { x: 0, y: 18 } };
    const pos = defaults[ruleset] || defaults.fiba;

    let entity;
    switch (type) {
      case 'offense':
        entity = { type: 'offense', nr: this.state.nextEntityNr('offense'), x: pos.x, y: pos.y };
        break;
      case 'defense':
        entity = { type: 'defense', nr: this.state.nextEntityNr('defense'), x: pos.x - 0.5, y: pos.y + 0.5 };
        break;
      case 'ball':
        entity = { type: 'ball', x: pos.x + 0.5, y: pos.y };
        break;
      case 'coach':
        entity = { type: 'coach', x: -3, y: pos.y + 2 };
        break;
      case 'cone':
        entity = { type: 'cone', nr: this.state.nextEntityNr('cone'), x: pos.x, y: pos.y - 1 };
        break;
      case 'station':
        entity = { type: 'station', nr: this.state.nextEntityNr('station'), x: pos.x + 2, y: pos.y };
        break;
    }
    if (entity) this.state.addEntity(entity);
  }
}

function el(tag, attrs = {}, text) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') e.className = v;
    else e.setAttribute(k, v);
  }
  if (text) e.textContent = text;
  return e;
}

# Contributing to OCF Editor

## Getting Started

```bash
git clone https://github.com/opencoachingformat/editor.git
cd editor
npm install
npm run build
open index.html
```

## Development

Use `watch` mode for live rebuilds while editing source files:

```bash
npm run watch
```

Then refresh `index.html` in your browser after making changes.

## Code Structure

| Module | Description |
|--------|-------------|
| `src/schema.js` | Embedded OCF v1.0.0 JSON Schema and `createBlankDocument()` factory |
| `src/main.js` | Entry point — initializes the app and wires all modules together |
| `src/court/` | SVG court rendering for all rulesets (FIBA, NBA, NCAA, NFHS) |
| `src/editor/` | Interaction layer: drag-and-drop, line drawing, entity selection |
| `src/player/` | Frame navigation and animation playback controller |
| `src/export/validate.js` | Lightweight structural OCF validator (no external runtime dependencies) |
| `src/export/json.js` | JSON serialization and import helpers |

## Validating Examples

```bash
node scripts/validate-examples.js
```

This runs automatically in CI. Exit code 1 if any `examples/*.ocf.json` file fails validation.

## Schema Sync

When the OCF spec schema (`opencoachingformat/spec` → `schema/v1.json`) is updated:

1. Sync changes into both `src/schema.js` and `opencoachingformat-v1.schema.json`
2. Preserve the two intentional deviations documented at the top of `src/schema.js`:
   - `meta.created` / `meta.modified`: `string` without `format: "date-time"`
   - `meta.source_url`: `string` without `format: "uri"`
3. Run `node scripts/validate-examples.js` to verify examples still pass

## Branch Naming

- `feat/<description>` — new features
- `fix/<description>` — bug fixes
- `docs/<description>` — documentation-only changes

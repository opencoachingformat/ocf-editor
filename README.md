# OCF Editor

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Schema](https://img.shields.io/badge/Schema-v1.0.0-green.svg)](opencoachingformat-v1.schema.json)
[![CI](https://github.com/opencoachingformat/ocf-editor/actions/workflows/ci.yml/badge.svg)](https://github.com/opencoachingformat/ocf-editor/actions/workflows/ci.yml)

Reference web editor for the [Open Coaching Format](https://github.com/opencoachingformat/spec) — an open standard for basketball drill diagrams and animations.

**Live demo (latest release):** https://opencoachingformat.github.io/ocf-editor
**Preview (current `main`):** https://opencoachingformat.github.io/ocf-editor/preview/

> The root URL serves the latest tagged release; `/preview/` always tracks the
> current `main` and is redeployed on every merge (after CI passes). See
> [Releases & Deployment](#releases--deployment). Architecture is documented in
> [doc/arc42.md](doc/arc42.md).

---

## Features

- Visual basketball court editor (half-court and full-court)
- Drag-and-drop entities: offense, defense, coach, cone, station, ball
- Draw movement, passing, dribbling, screen, and free lines
- Multi-frame drills with entity state deltas
- Real-time JSON panel with OCF-compliant output
- Import / Export `.ocf.json` files
- Validates documents against the embedded OCF v1.0.0 schema

## Quick Start

```bash
git clone https://github.com/opencoachingformat/ocf-editor.git
cd ocf-editor
npm install
npm run build
# Open index.html in your browser
open index.html
```

## Project Structure

```
src/
  schema.js          — Embedded OCF v1.0.0 JSON Schema + createBlankDocument()
  main.js            — Application entry point, wires all modules
  court/             — SVG court rendering (FIBA, NBA, NCAA, NFHS dimensions)
  editor/            — Interaction: drag/drop, line drawing, selection
  player/            — Frame navigation and animation playback
  export/
    validate.js      — Structural OCF validator (no external dependencies)
    json.js          — JSON serialization / import helpers
examples/
  pick-and-roll.ocf.json
  3-man-weave.ocf.json
scripts/
  validate-examples.js  — CI script: validates all examples/*.ocf.json
```

## OCF Format

OCF (Open Coaching Format) is a JSON-based standard for basketball drill diagrams. The specification lives at [opencoachingformat/spec](https://github.com/opencoachingformat/spec).

This editor intentionally deviates from the spec in two places for `ajv` strict-mode compatibility — see the comment block at the top of `src/schema.js` for details.

## Releases & Deployment

GitHub Pages hosts two builds side by side:

- **`/`** (root) — the latest **release**, built from the newest `v*` tag.
- **`/preview/`** — the current **`main`**, redeployed on every merge (after CI passes).

Until the first release tag exists, the root mirrors the preview build.

To cut a release:

1. Bump `version` in `package.json` — the only place it lives. The build injects
   it into the in-app badge (`scripts/build.js`), and the E2E test derives it.
2. Commit and merge to `main`.
3. Tag the merge commit and push the tag:
   ```bash
   git tag v0.3.0
   git push origin v0.3.0
   ```

CI refuses to deploy a tag whose `package.json` version doesn't match it
(`scripts/check-version.sh`). The Pages site is assembled by
`scripts/build-pages.sh`, which you can run locally (`bash scripts/build-pages.sh`)
to preview the exact deployed layout in `./_site`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

- Editor source code: **MIT** — see [LICENSE](LICENSE)
- OCF Specification: **CC BY 4.0** — see [opencoachingformat/spec](https://github.com/opencoachingformat/spec)

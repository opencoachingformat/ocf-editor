#!/usr/bin/env bash
#
# Build the full GitHub Pages site into ./_site:
#   /          → newest v* release tag (the "final" build)
#   /preview/  → current main (the "test" build)
#
# Both variants are rebuilt from their own source tree on every deploy, so the
# Pages site always contains both the latest release and the latest preview.
# The app uses only relative asset paths, so it works from any sub-path.
#
# Requires: git, node + npm deps installed (esbuild) in the current checkout.
#
# Usage: scripts/build-pages.sh [output_dir]
set -euo pipefail

OUT="${1:-_site}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Files that make up a deployable site (everything index.html references).
STATIC_FILES=(style.css opencoachingformat-v1.schema.json)

# Build one variant from a git ref into a target directory.
# $1 = git ref (tag or branch), $2 = target dir, $3 = version label (optional;
# empty → scripts/build.js derives "v<version>" from that ref's package.json).
build_variant() {
  local ref="$1" dest="$2" label="$3"
  local src
  src="$(mktemp -d)"
  echo "→ building '$ref' (version: ${label:-from package.json}) into $dest"
  git archive "$ref" | tar -x -C "$src"

  # Build with this checkout's scripts/build.js (it has esbuild via node_modules)
  # against the extracted ref as the working directory, so the version is taken
  # from the ref's own package.json — or from APP_VERSION when we pass a label.
  # Older refs whose main.js predates build-time injection simply keep their
  # static badge, which for a release tag already equals the tag version.
  ( cd "$src" && APP_VERSION="$label" node "$ROOT/scripts/build.js" )

  mkdir -p "$dest"
  cp "$src/ocf-bundle.js" "$src/ocf-bundle.js.map" "$dest"/
  cp "$src/index.html" "$dest/index.html"
  for f in "${STATIC_FILES[@]}"; do
    [ -e "$src/$f" ] && cp "$src/$f" "$dest/"
  done
  [ -d "$src/examples" ] && cp -r "$src/examples" "$dest/examples"

  rm -rf "$src"
}

rm -rf "$OUT"
mkdir -p "$OUT"

# Resolve "main" robustly: when CI checks out a tag, main may only exist as a
# remote-tracking ref.
if git rev-parse --verify --quiet main >/dev/null; then
  MAIN_REF="main"
elif git rev-parse --verify --quiet origin/main >/dev/null; then
  MAIN_REF="origin/main"
else
  MAIN_REF="HEAD"
fi

# Newest release tag, if any (semantic sort).
LATEST_TAG="$(git tag -l 'v*' --sort=-v:refname | head -n1 || true)"

if [ -n "$LATEST_TAG" ]; then
  # Empty label → build.js stamps "v<version>" from the tag's package.json.
  build_variant "$LATEST_TAG" "$OUT" ""
else
  # No release yet → root shows the preview build so the site is never empty.
  echo "→ no v* tag found; root will mirror the preview build"
  build_variant "$MAIN_REF" "$OUT" "main-preview"
fi

# Always (re)build the preview from main into /preview.
build_variant "$MAIN_REF" "$OUT/preview" "main-preview"

echo "✓ Pages site assembled in $OUT"
ls -la "$OUT"

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
ESBUILD="$ROOT/node_modules/.bin/esbuild"

# Files that make up a deployable site (everything index.html references).
STATIC_FILES=(style.css opencoachingformat-v1.schema.json)

# Build one variant from a git ref into a target directory, stamping the version.
# $1 = git ref (tag or branch), $2 = target dir, $3 = version label for the badge
build_variant() {
  local ref="$1" dest="$2" version="$3"
  local src
  src="$(mktemp -d)"
  echo "→ building '$ref' as version '$version' into $dest"
  git archive "$ref" | tar -x -C "$src"

  mkdir -p "$dest"
  "$ESBUILD" "$src/src/main.js" --bundle \
    --outfile="$dest/ocf-bundle.js" --format=iife \
    --global-name=OCFEditor --sourcemap

  cp "$src/index.html" "$dest/index.html"
  for f in "${STATIC_FILES[@]}"; do
    [ -e "$src/$f" ] && cp "$src/$f" "$dest/"
  done
  [ -d "$src/examples" ] && cp -r "$src/examples" "$dest/examples"

  # Stamp the in-app version badge so the deployed build self-reports its version.
  if [ -n "$version" ]; then
    sed -i "s#<span class=\"app-version\">[^<]*</span>#<span class=\"app-version\">${version}</span>#" "$dest/index.html"
  fi

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
  build_variant "$LATEST_TAG" "$OUT" "$LATEST_TAG"
else
  # No release yet → root shows the preview build so the site is never empty.
  echo "→ no v* tag found; root will mirror the preview build"
  build_variant "$MAIN_REF" "$OUT" "main-preview"
fi

# Always (re)build the preview from main into /preview.
build_variant "$MAIN_REF" "$OUT/preview" "main-preview"

echo "✓ Pages site assembled in $OUT"
ls -la "$OUT"

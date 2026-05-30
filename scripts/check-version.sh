#!/usr/bin/env bash
#
# Verify that package.json's version matches a release tag.
# Used by CI on tag pushes so a release can never ship a mismatched version.
#
# Usage: scripts/check-version.sh <tag>     e.g. check-version.sh v0.2.0
set -euo pipefail

TAG="${1:?usage: check-version.sh <tag>}"
TAG_VERSION="${TAG#v}"   # strip leading "v"

PKG_VERSION="$(node -p "require('./package.json').version")"

if [ "$TAG_VERSION" != "$PKG_VERSION" ]; then
  echo "::error::Version mismatch — tag is '$TAG' (=$TAG_VERSION) but package.json is '$PKG_VERSION'."
  echo "Update package.json to $TAG_VERSION (and the version badge) before tagging, or retag to match."
  exit 1
fi

echo "✓ Version OK: tag $TAG matches package.json $PKG_VERSION"

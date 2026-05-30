#!/usr/bin/env node
//
// Build the OCF Editor bundle with esbuild.
//
// The app version is injected at build time from a single source of truth —
// package.json — so it never has to be kept in sync by hand. npm exposes the
// version as $npm_package_version when this runs via `npm run build`; when the
// script is invoked directly (e.g. by build-pages.sh against a checked-out
// release) it falls back to the package.json in the current working directory.
//
// The display string can be overridden with the APP_VERSION env var (used by
// build-pages.sh to label the /preview build), otherwise it is `v<version>`.
//
// Usage: node scripts/build.js [--watch]
'use strict';

const path = require('path');
const esbuild = require('esbuild');

// Resolve project files relative to the working directory, so this script can
// build either the repo root (npm run build) or an extracted release tree.
const cwd = process.cwd();
const pkg = require(path.join(cwd, 'package.json'));

const version =
  process.env.APP_VERSION || `v${process.env.npm_package_version || pkg.version}`;

const options = {
  entryPoints: [path.join(cwd, 'src/main.js')],
  bundle: true,
  outfile: path.join(cwd, 'ocf-bundle.js'),
  format: 'iife',
  globalName: 'OCFEditor',
  sourcemap: true,
  define: { __APP_VERSION__: JSON.stringify(version) },
};

(async () => {
  if (process.argv.includes('--watch')) {
    const ctx = await esbuild.context(options);
    await ctx.watch();
    console.log(`esbuild: watching for changes (version ${version})…`);
  } else {
    await esbuild.build(options);
    console.log(`esbuild: built ocf-bundle.js (version ${version})`);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

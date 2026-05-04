const path = require('node:path');
const fs = require('node:fs');
const { execSync } = require('node:child_process');
const chokidar = require('chokidar');
const express = require('express');
const glob = require('glob');
const esbuild = require('esbuild');

const util = require('node:util');

const PORT = 3000;
const BUILD_DIR = '/tmp/nhost-build';
const DIST_DIR = path.join(BUILD_DIR, 'dist');
const WRAPPER_DIR = path.join(BUILD_DIR, 'wrappers');

function logJSON(obj) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

function serverLog(level, route, ...args) {
  logJSON({ log: util.format(...args), path: route, level });
}

// Map of route -> Express app (loaded from esbuild bundles)
const functionHandlers = new Map();

// Map of file path -> { wrapperPath, outfile, route, safeName }
const functionEntries = new Map();

// Track discovered functions for metadata endpoint
const functionMeta = new Map();

// Single esbuild context covering every function's wrapper as an entry point.
// Per-function contexts retained the parsed dep graph (express, aws-sdk, ...)
// once per function, multiplying memory by N. A single context shares one
// module graph across all entry points while still emitting an independent
// bundle per function — matching the per-Lambda artifact layout in prod.
let buildContext = null;

// setInterval does not await its async callback, so two polls can overlap if a
// rebuild runs longer than the polling interval — exactly the case for big
// projects. Serialize all rebuilds behind a single in-flight promise so dispose
// and create are strictly sequential and no context is leaked.
let rebuildInFlight = Promise.resolve();
function scheduleRebuild(functionsPath) {
  rebuildInFlight = rebuildInFlight
    .catch(() => {})
    .then(() => rebuildContext(functionsPath));
  return rebuildInFlight;
}

// Incremental rebuild reuses the existing context (no dispose/recreate), used
// when only file contents changed (not the entry-point set).
function scheduleIncrementalRebuild() {
  rebuildInFlight = rebuildInFlight
    .catch(() => {})
    .then(async () => {
      if (buildContext) {
        await buildContext.rebuild();
      }
    });
  return rebuildInFlight;
}

const wrapperTemplate = fs.readFileSync(
  path.join(__dirname, 'local-wrapper.js'),
  'utf-8',
);

function getNodeTarget() {
  const major = process.version.split('.')[0].substring(1);
  return `node${major}`;
}

function getRuntime() {
  const major = process.version.split('.')[0].substring(1);
  return `nodejs${major}.x`;
}

function discoverFunctions(functionsPath) {
  return glob.sync('**/*.@(js|ts)', {
    cwd: functionsPath,
    ignore: ['**/node_modules/**', '**/_*/**', '**/_*'],
  });
}

function fileToRoute(file) {
  return `/${file}`.replace(/(\.ts|\.js)$/, '').replace(/\/index$/, '/');
}

function fileToSafeName(file) {
  return file
    .replace(/(\.ts|\.js)$/, '')
    .replace(/\//g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '_');
}

function generateWrapper(relativeFunctionPath) {
  return wrapperTemplate.replace('%FUNCTION_PATH%', relativeFunctionPath);
}

function prepareFunctionEntry(functionsPath, file) {
  const safeName = fileToSafeName(file);
  const wrapperPath = path.join(WRAPPER_DIR, `.wrapper-${safeName}.js`);
  const absoluteFuncPath = path.join(functionsPath, file);
  fs.writeFileSync(wrapperPath, generateWrapper(absoluteFuncPath));

  const outfile = path.join(DIST_DIR, `${safeName}.js`);
  const route = fileToRoute(file);

  functionEntries.set(file, { wrapperPath, outfile, route, safeName });
  functionMeta.set(file, {
    path: path.join('functions', file),
    route,
    runtime: getRuntime(),
    createdAt: '0001-01-01T00:00:00Z',
    updatedAt: '0001-01-01T00:00:00Z',
    functionName: '',
    createdWithCommitSha: 'localdev',
  });
}

function disposeFunctionEntry(file) {
  const entry = functionEntries.get(file);
  if (!entry) return;

  try {
    fs.unlinkSync(entry.wrapperPath);
  } catch {}
  try {
    fs.unlinkSync(entry.outfile);
    fs.unlinkSync(`${entry.outfile}.map`);
  } catch {}

  functionEntries.delete(file);
  functionMeta.delete(file);
  functionHandlers.delete(entry.route);
}

function loadBundle(route, bundlePath) {
  // Clear require cache so re-requiring gets fresh code
  const resolved = require.resolve(bundlePath);
  delete require.cache[resolved];

  try {
    const bundled = require(bundlePath);
    // The bundle exports an Express app (or app.default)
    const app = bundled.default || bundled;
    functionHandlers.set(route, app);
  } catch (err) {
    serverLog('ERROR', route, `Failed to load bundle:`, err);
    functionHandlers.delete(route);
  }
}

async function rebuildContext(functionsPath) {
  if (buildContext) {
    await buildContext.dispose();
    buildContext = null;
  }

  if (functionEntries.size === 0) return;

  const nodePaths = process.env.NODE_PATH
    ? process.env.NODE_PATH.split(path.delimiter)
    : [];

  const entryPoints = {};
  for (const [, entry] of functionEntries) {
    entryPoints[entry.safeName] = entry.wrapperPath;
  }

  const ctx = await esbuild.context({
    entryPoints,
    bundle: true,
    minify: true,
    platform: 'node',
    target: getNodeTarget(),
    sourcemap: true,
    outdir: DIST_DIR,
    nodePaths,
    logLevel: 'warning',
    plugins: [
      {
        name: 'reload-notifier',
        setup(build) {
          build.onEnd((result) => {
            for (const err of result.errors) {
              serverLog(
                'ERROR',
                err.location?.file || '',
                `Build error: ${err.text}`,
              );
            }
            // esbuild writes outputs atomically: on any error, no bundles are
            // (re)written, so we keep the previously loaded handlers in place.
            if (result.errors.length > 0) return;

            for (const [file, entry] of functionEntries) {
              if (!fs.existsSync(path.join(functionsPath, file))) continue;
              if (!fs.existsSync(entry.outfile)) continue;
              loadBundle(entry.route, entry.outfile);
              serverLog('INFO', entry.route, `Rebuilt from ${file}`);
            }
          });
        },
      },
    ],
  });

  await ctx.rebuild();
  // Do NOT call ctx.watch() — inotify/FSEvents are unreliable on Docker
  // bind-mount volumes. Change detection is handled by chokidar with
  // usePolling: true (see watchers in main()).
  buildContext = ctx;
}

function findRoute(reqPath) {
  // Exact match
  if (functionHandlers.has(reqPath)) {
    return functionHandlers.get(reqPath);
  }

  // Try with trailing slash stripped
  const withoutTrailing = reqPath.replace(/\/$/, '') || '/';
  if (functionHandlers.has(withoutTrailing)) {
    return functionHandlers.get(withoutTrailing);
  }

  // Try with trailing slash added
  const withTrailing = reqPath.endsWith('/') ? reqPath : `${reqPath}/`;
  if (functionHandlers.has(withTrailing)) {
    return functionHandlers.get(withTrailing);
  }

  return null;
}

const main = async () => {
  const app = express();

  app.get('/healthz', (_req, res) => {
    res.status(200).send('ok');
  });

  const functionsPath = path.join(
    process.cwd(),
    process.env.FUNCTIONS_RELATIVE_PATH,
  );

  // Metadata endpoint
  app.options('/_nhost_functions_metadata', (_req, res) => {
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': '*',
      'Access-Control-Allow-Headers': '*',
    });
    res.sendStatus(204);
  });
  app.get('/_nhost_functions_metadata', (_req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.json({ functions: Array.from(functionMeta.values()) });
  });

  fs.mkdirSync(WRAPPER_DIR, { recursive: true });
  fs.mkdirSync(DIST_DIR, { recursive: true });

  // Discover and prepare all function entries
  for (const file of discoverFunctions(functionsPath)) {
    prepareFunctionEntry(functionsPath, file);
  }

  try {
    await scheduleRebuild(functionsPath);
  } catch (err) {
    serverLog('ERROR', '', 'Failed initial build:', err);
  }

  // Catch-all route — looks up handler from map
  app.all('/{*path}', (req, res, next) => {
    const handler = findRoute(req.path);
    if (handler) {
      handler(req, res, next);
    } else {
      res.status(404).send('Function not found');
    }
  });

  // Tear down all entries and rebuild from scratch (used after dependency changes)
  async function rebuildAll() {
    for (const file of [...functionEntries.keys()]) {
      disposeFunctionEntry(file);
    }
    for (const file of discoverFunctions(functionsPath)) {
      prepareFunctionEntry(functionsPath, file);
    }
    await scheduleRebuild(functionsPath);
  }

  // Mirrors discoverFunctions's filter: .js/.ts not under any underscore-
  // prefixed segment (e.g. _utils/). chokidar's `ignored` already drops
  // node_modules, so we only re-check the underscore rule here.
  function isEntryFile(absPath) {
    const rel = path.relative(functionsPath, absPath);
    if (!/\.(js|ts)$/.test(rel)) return false;
    for (const segment of rel.split(path.sep)) {
      if (segment.startsWith('_')) return false;
    }
    return true;
  }

  const triggerFullRebuild = () =>
    scheduleRebuild(functionsPath).catch((err) =>
      serverLog('ERROR', '', 'Failed to rebuild context:', err),
    );
  const triggerIncrementalRebuild = () =>
    scheduleIncrementalRebuild().catch((err) =>
      serverLog('ERROR', '', 'Incremental rebuild failed:', err),
    );

  // Watch the functions tree. usePolling is required because inotify/FSEvents
  // don't propagate over Docker bind-mount volumes; chokidar's polling mode
  // gives us proper add/change/unlink semantics (instead of everything
  // arriving as "change") plus awaitWriteFinish to coalesce editor atomic-
  // write sequences into a single event.
  const watcher = chokidar.watch(functionsPath, {
    ignored: (p) => /[\\/]node_modules(?:[\\/]|$)/.test(p),
    ignoreInitial: true,
    usePolling: true,
    interval: 1000,
    binaryInterval: 3000,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 },
  });

  watcher.on('add', (absPath) => {
    const rel = path.relative(functionsPath, absPath);
    if (isEntryFile(absPath) && !functionEntries.has(rel)) {
      serverLog('INFO', fileToRoute(rel), `New function detected: ${rel}`);
      prepareFunctionEntry(functionsPath, rel);
      triggerFullRebuild();
    } else {
      // Non-entry add (e.g. new _utils/foo.js) — an existing function may
      // import it, so a rebuild on the current context is enough.
      triggerIncrementalRebuild();
    }
  });

  watcher.on('unlink', (absPath) => {
    const rel = path.relative(functionsPath, absPath);
    if (functionEntries.has(rel)) {
      const route = fileToRoute(rel);
      disposeFunctionEntry(rel);
      serverLog('INFO', route, `Removed (${rel} deleted)`);
      triggerFullRebuild();
    } else {
      triggerIncrementalRebuild();
    }
  });

  watcher.on('change', (absPath) => {
    const rel = path.relative(functionsPath, absPath);
    serverLog('INFO', '', `Changed: ${rel}`);
    triggerIncrementalRebuild();
  });

  // Watch dependency manifests so a saved package.json / lockfile triggers
  // `nci` followed by a full rebuild.
  const workingDir = process.cwd();
  const depFiles = [
    'package.json',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
  ].map((f) => path.join(workingDir, f));

  const depWatcher = chokidar.watch(depFiles, {
    ignoreInitial: true,
    usePolling: true,
    interval: 1000,
    awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
  });

  depWatcher.on('change', async (filePath) => {
    console.log(
      `Dependency file changed: ${path.basename(filePath)} — reinstalling...`,
    );
    try {
      execSync('nci', { cwd: workingDir, stdio: 'inherit' });
      console.log('Dependencies installed. Rebuilding all functions...');
      await rebuildAll();
    } catch (err) {
      console.error('Failed to reinstall dependencies:', err);
    }
  });

  app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
  });
};

main();

const path = require('node:path');
const fs = require('node:fs');
const { execSync } = require('node:child_process');
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
  await ctx.watch();
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

  // Poll for new/deleted function files. Filesystem events (chokidar/inotify)
  // are unreliable over Docker volume mounts — add/unlink all arrive as
  // "change", so we periodically re-discover and diff instead. When the entry
  // set changes, the esbuild context is recreated with the new entry points;
  // edits inside existing functions are picked up by ctx.watch() without a
  // recreate.
  setInterval(async () => {
    const currentFiles = new Set(discoverFunctions(functionsPath));
    const knownFiles = new Set(functionEntries.keys());

    let changed = false;

    for (const file of currentFiles) {
      if (!knownFiles.has(file)) {
        serverLog('INFO', fileToRoute(file), `New function detected: ${file}`);
        prepareFunctionEntry(functionsPath, file);
        changed = true;
      }
    }

    for (const file of knownFiles) {
      if (!currentFiles.has(file)) {
        const route = fileToRoute(file);
        disposeFunctionEntry(file);
        serverLog('INFO', route, `Removed (${file} deleted)`);
        changed = true;
      }
    }

    if (changed) {
      try {
        await scheduleRebuild(functionsPath);
      } catch (err) {
        serverLog('ERROR', '', 'Failed to rebuild context:', err);
      }
    }
  }, 1000);

  // Watch for dependency changes (package.json / lockfiles) via mtime polling.
  const workingDir = process.cwd();
  const depFiles = [
    'package.json',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
  ];
  const depMtimes = new Map();
  for (const f of depFiles) {
    try {
      depMtimes.set(f, fs.statSync(path.join(workingDir, f)).mtimeMs);
    } catch {}
  }
  setInterval(async () => {
    for (const file of depFiles) {
      const filePath = path.join(workingDir, file);
      let mtimeMs;
      try {
        mtimeMs = fs.statSync(filePath).mtimeMs;
      } catch {
        if (depMtimes.has(file)) depMtimes.delete(file);
        continue;
      }
      const prev = depMtimes.get(file);
      if (prev !== undefined && prev !== mtimeMs) {
        depMtimes.set(file, mtimeMs);
        console.log(`Dependency file changed: ${file} — reinstalling...`);
        try {
          execSync('nci', { cwd: workingDir, stdio: 'inherit' });
          console.log('Dependencies installed. Rebuilding all functions...');
          await rebuildAll();
        } catch (err) {
          console.error('Failed to reinstall dependencies:', err);
        }
        return; // rebuildAll already covers everything
      }
      depMtimes.set(file, mtimeMs);
    }
  }, 1000);

  app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
  });
};

main();

const path = require('node:path');
const fs = require('node:fs');
const { execSync } = require('node:child_process');
const express = require('express');
const glob = require('glob');
const esbuild = require('esbuild');

const util = require('node:util');

const PORT = 3000;
const BUILD_DIR = '/tmp/nhost-build';

function logJSON(obj) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

function serverLog(level, route, ...args) {
  logJSON({ log: util.format(...args), path: route, level });
}

// Map of route -> Express app (loaded from esbuild bundles)
const functionHandlers = new Map();

// Map of file path -> esbuild context (for disposing on delete)
const esbuildContexts = new Map();

// Track discovered functions for metadata endpoint
const functionMeta = new Map();

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

async function buildFunction(functionsPath, file) {
  const safeName = fileToSafeName(file);

  // Write wrapper under BUILD_DIR to avoid polluting the user's functions directory.
  // Use the absolute path to the function so require() resolution still works.
  const wrapperDir = path.join(BUILD_DIR, 'wrappers');
  fs.mkdirSync(wrapperDir, { recursive: true });
  const wrapperPath = path.join(wrapperDir, `.wrapper-${safeName}.js`);
  const absoluteFuncPath = path.join(functionsPath, file);
  const wrapperContent = generateWrapper(absoluteFuncPath);
  fs.writeFileSync(wrapperPath, wrapperContent);

  const distDir = path.join(BUILD_DIR, 'dist', safeName);
  fs.mkdirSync(distDir, { recursive: true });

  const outfile = path.join(distDir, 'bundle.js');
  const route = fileToRoute(file);

  // Resolve global node_modules (NODE_PATH) so esbuild can find express, etc.
  const nodePaths = process.env.NODE_PATH
    ? process.env.NODE_PATH.split(path.delimiter)
    : [];

  const ctx = await esbuild.context({
    entryPoints: [wrapperPath],
    bundle: true,
    minify: true,
    platform: 'node',
    target: getNodeTarget(),
    sourcemap: true,
    outfile,
    nodePaths,
    logLevel: 'warning',
    plugins: [
      {
        name: 'reload-notifier',
        setup(build) {
          build.onEnd((result) => {
            if (result.errors.length > 0) return;
            if (!fs.existsSync(path.join(functionsPath, file))) return;
            loadBundle(route, outfile, safeName);
            serverLog('INFO', route, `Rebuilt from ${file}`);
          });
        },
      },
    ],
  });

  // Initial build
  await ctx.rebuild();

  // Start watching for changes
  await ctx.watch();

  esbuildContexts.set(file, { ctx, wrapperPath });

  // Store metadata
  functionMeta.set(file, {
    path: path.join('functions', file),
    route,
    runtime: getRuntime(),
    createdAt: '0001-01-01T00:00:00Z',
    updatedAt: '0001-01-01T00:00:00Z',
    functionName: '',
    createdWithCommitSha: 'localdev',
  });

  serverLog('INFO', route, `Loaded from ${file}`);
}

function loadBundle(route, bundlePath, _safeName) {
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

async function removeFunction(_functionsPath, file) {
  const entry = esbuildContexts.get(file);
  if (entry) {
    await entry.ctx.dispose();
    // Clean up wrapper file
    try {
      fs.unlinkSync(entry.wrapperPath);
    } catch {}
    esbuildContexts.delete(file);
  }

  const route = fileToRoute(file);
  functionHandlers.delete(route);
  functionMeta.delete(file);

  // Clean up build artifacts
  const safeName = fileToSafeName(file);
  const distDir = path.join(BUILD_DIR, 'dist', safeName);
  fs.rmSync(distDir, { recursive: true, force: true });

  serverLog('INFO', route, `Removed (${file} deleted)`);
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

  // Discover and build all functions
  const files = discoverFunctions(functionsPath);

  // Ensure build directory exists
  fs.mkdirSync(path.join(BUILD_DIR, 'dist'), { recursive: true });

  for (const file of files) {
    try {
      await buildFunction(functionsPath, file);
    } catch (err) {
      serverLog('ERROR', fileToRoute(file), `Failed to build ${file}:`, err);
    }
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

  // Rebuild all functions (used after dependency changes)
  async function rebuildAll() {
    // Dispose all existing esbuild contexts
    for (const [_file, entry] of esbuildContexts) {
      await entry.ctx.dispose();
      try {
        fs.unlinkSync(entry.wrapperPath);
      } catch {}
    }
    esbuildContexts.clear();
    functionHandlers.clear();
    functionMeta.clear();

    const files = discoverFunctions(functionsPath);
    for (const file of files) {
      try {
        await buildFunction(functionsPath, file);
      } catch (err) {
        serverLog('ERROR', fileToRoute(file), `Failed to build ${file}:`, err);
      }
    }
  }

  // Poll for new/deleted function files. Filesystem events (chokidar/inotify)
  // are unreliable over Docker volume mounts — add/unlink all arrive as
  // "change", so we periodically re-discover and diff instead.
  setInterval(async () => {
    const currentFiles = new Set(discoverFunctions(functionsPath));
    const knownFiles = new Set(esbuildContexts.keys());

    for (const file of currentFiles) {
      if (!knownFiles.has(file)) {
        serverLog('INFO', fileToRoute(file), `New function detected: ${file}`);
        try {
          await buildFunction(functionsPath, file);
        } catch (err) {
          serverLog(
            'ERROR',
            fileToRoute(file),
            `Failed to build ${file}:`,
            err,
          );
        }
      }
    }

    for (const file of knownFiles) {
      if (!currentFiles.has(file)) {
        await removeFunction(functionsPath, file);
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

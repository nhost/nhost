const path = require('node:path');
const fs = require('node:fs');
const { execSync } = require('node:child_process');
const express = require('express');
const morgan = require('morgan');
const glob = require('glob');
const esbuild = require('esbuild');
const chokidar = require('chokidar');

const PORT = 3000;
const BUILD_DIR = '.nhost-build';

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
    ignore: [
      '**/node_modules/**',
      '**/_*/**',
      '**/_*',
      '**/.wrapper-*',
      `**/${BUILD_DIR}/**`,
    ],
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
  const funcDir = path.dirname(path.join(functionsPath, file));
  const funcBasename = path.basename(file);

  // Write wrapper in the same directory as the function for correct require() resolution
  const wrapperPath = path.join(funcDir, `.wrapper-${safeName}.js`);
  const wrapperContent = generateWrapper(`./${funcBasename}`);
  fs.writeFileSync(wrapperPath, wrapperContent);

  const distDir = path.join(functionsPath, BUILD_DIR, 'dist', safeName);
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
            if (result.errors.length === 0) {
              loadBundle(route, outfile, safeName);
              console.log(`Rebuilt ${route} from ${file}`);
            }
          });
          // Clean up wrapper file after initial build resolves dependencies
          build.onStart(() => {});
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

  console.log(`Loaded route ${route} from ${file}`);
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
    console.error(`Failed to load bundle for ${route}:`, err);
    functionHandlers.delete(route);
  }
}

async function removeFunction(functionsPath, file) {
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
  const distDir = path.join(functionsPath, BUILD_DIR, 'dist', safeName);
  fs.rmSync(distDir, { recursive: true, force: true });

  console.log(`Removed route ${route} (${file} deleted)`);
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

  // Log middleware — skip /healthz (docker health checks)
  app.use(
    morgan('tiny', {
      skip: (req) => req.url === '/healthz',
    }),
  );

  app.get('/healthz', (_req, res) => {
    res.status(200).send('ok');
  });

  const functionsPath = path.join(
    process.cwd(),
    process.env.FUNCTIONS_RELATIVE_PATH,
  );

  // Metadata endpoint
  app.get('/_nhost_functions_metadata', (_req, res) => {
    res.json({ functions: Array.from(functionMeta.values()) });
  });

  // Discover and build all functions
  const files = discoverFunctions(functionsPath);

  // Ensure build directory exists
  fs.mkdirSync(path.join(functionsPath, BUILD_DIR, 'dist'), {
    recursive: true,
  });

  for (const file of files) {
    try {
      await buildFunction(functionsPath, file);
    } catch (err) {
      console.error(`Failed to build function ${file}:`, err);
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
        console.error(`Failed to build function ${file}:`, err);
      }
    }
  }

  // Watch for new/deleted function files
  const functionWatcher = chokidar.watch('**/*.{js,ts}', {
    cwd: functionsPath,
    ignored: [
      '**/node_modules/**',
      '**/_*/**',
      '**/_*',
      '**/.wrapper-*',
      `**/${BUILD_DIR}/**`,
    ],
    ignoreInitial: true,
  });

  functionWatcher.on('add', async (file) => {
    if (esbuildContexts.has(file)) return;
    console.log(`New function detected: ${file}`);
    try {
      await buildFunction(functionsPath, file);
    } catch (err) {
      console.error(`Failed to build new function ${file}:`, err);
    }
  });

  functionWatcher.on('unlink', async (file) => {
    if (!esbuildContexts.has(file)) return;
    await removeFunction(functionsPath, file);
  });

  // Watch for dependency changes (package.json / lockfiles)
  const workingDir = path.join(
    process.cwd(),
    process.env.FUNCTIONS_WORKING_DIR || '.',
  );
  const depWatcher = chokidar.watch(
    ['package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'],
    { cwd: workingDir, ignoreInitial: true },
  );

  depWatcher.on('change', async (file) => {
    console.log(`Dependency file changed: ${file} — reinstalling...`);
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

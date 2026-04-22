const crypto = require('node:crypto');
const { AsyncLocalStorage } = require('node:async_hooks');
const util = require('node:util');
const express = require('express');
const app = express();

const asyncLocalStorage = new AsyncLocalStorage();

function logJSON(obj) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

// Intercept console methods to emit structured JSON during request handling.
// Outside of a request context (e.g. at module load time), the original
// console methods are used unchanged.
const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
};

function wrapConsoleMethod(original, level) {
  return (...args) => {
    const store = asyncLocalStorage.getStore();
    if (store) {
      logJSON({
        log: util.format(...args),
        path: store.path,
        invocationId: store.invocationId,
        level,
      });
    } else {
      original.apply(console, args);
    }
  };
}

console.log = wrapConsoleMethod(originalConsole.log, 'INFO');
console.info = wrapConsoleMethod(originalConsole.info, 'INFO');
console.warn = wrapConsoleMethod(originalConsole.warn, 'WARN');
console.error = wrapConsoleMethod(originalConsole.error, 'ERROR');

const rawBodySaver = (req, _res, buf) => {
  req.rawBody = buf.toString();
};

// Default CORS headers. We wrap res.writeHead so the check runs once headers
// are about to be flushed — at that point any res.setHeader / res.set call
// from user code (or middleware like the `cors` package) has already landed,
// so we only add a default for headers the user didn't set themselves.
app.use((_req, res, next) => {
  const originalWriteHead = res.writeHead;
  res.writeHead = function (...args) {
    if (!res.hasHeader('Access-Control-Allow-Origin')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    if (!res.hasHeader('Access-Control-Allow-Headers')) {
      res.setHeader(
        'Access-Control-Allow-Headers',
        'origin,Accept,Authorization,Content-Type',
      );
    }
    return originalWriteHead.apply(this, args);
  };
  next();
});

app.use(express.json({ limit: '6MB', verify: rawBodySaver }));
app.use(
  express.urlencoded({ extended: true, limit: '6MB', verify: rawBodySaver }),
);

app.set('trust proxy', true);
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.header('Server', 'Nhost');
  req.invocationId = crypto.randomUUID();

  const store = {
    invocationId: req.invocationId,
    path: req.path,
  };

  asyncLocalStorage.run(store, () => {
    const startTime = process.hrtime.bigint();
    let responseStartTime;
    let producedBytes = 0;

    const originalWrite = res.write;
    const originalEnd = res.end;

    res.write = function (chunk, ...args) {
      if (!responseStartTime) {
        responseStartTime = process.hrtime.bigint();
      }
      if (chunk) {
        producedBytes += Buffer.byteLength(chunk);
      }
      return originalWrite.call(this, chunk, ...args);
    };

    res.end = function (chunk, ...args) {
      if (!responseStartTime) {
        responseStartTime = process.hrtime.bigint();
      }
      if (chunk) {
        producedBytes += Buffer.byteLength(chunk);
      }
      return originalEnd.call(this, chunk, ...args);
    };

    res.on('finish', () => {
      const endTime = process.hrtime.bigint();
      const totalDurationMs = Number(endTime - startTime) / 1e6;
      const responseLatencyMs =
        Number((responseStartTime || endTime) - startTime) / 1e6;
      const responseDurationMs =
        Number(endTime - (responseStartTime || endTime)) / 1e6;

      const now = new Date();
      const requestStartDate = new Date(now.getTime() - totalDurationMs);
      const responseStartDate = new Date(
        requestStartDate.getTime() + responseLatencyMs,
      );

      logJSON({
        invocationId: req.invocationId,
        metrics: {
          durationMs: Math.round(totalDurationMs * 1000) / 1000,
          producedBytes,
        },
        path: req.path,
        spans: [
          {
            durationMs: Math.round(responseLatencyMs * 1000) / 1000,
            name: 'responseLatency',
            start: requestStartDate.toISOString(),
          },
          {
            durationMs: Math.round(responseDurationMs * 1000) / 1000,
            name: 'responseDuration',
            start: responseStartDate.toISOString(),
          },
        ],
        status: res.statusCode < 500 ? 'success' : 'error',
      });
    });

    next();
  });
});

let func;
try {
  const requiredFile = require('%FUNCTION_PATH%');
  if (typeof requiredFile === 'function') {
    func = requiredFile;
  } else if (typeof requiredFile.default === 'function') {
    func = requiredFile.default;
  } else {
    throw new Error('Invalid module export: must export a function');
  }
} catch (error) {
  console.error('Error loading function:', error);
  func = (_req, res) => res.status(500).send('Internal Server Error');
}

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res)).catch(next);
};

app.all('/{*path}', asyncHandler(func));

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  if (!res.headersSent) {
    res.status(500).send('Internal Server Error');
  }
});

module.exports = app;
module.exports.default = app;

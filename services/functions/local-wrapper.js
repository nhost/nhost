const crypto = require('node:crypto');
const express = require('express');
const app = express();

const rawBodySaver = (req, _res, buf) => {
  req.rawBody = buf.toString();
};

app.use(express.json({ limit: '6MB', verify: rawBodySaver }));
app.use(
  express.urlencoded({ extended: true, limit: '6MB', verify: rawBodySaver }),
);

app.set('trust proxy', true);
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.header('Server', 'Nhost');
  req.invocationId = crypto.randomUUID();
  next();
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

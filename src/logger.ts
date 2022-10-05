import winston from 'winston';
import expressWinston, { LoggerOptions } from 'express-winston';

export const LOG_LEVEL = process.env.AUTH_LOG_LEVEL || 'info';

// * Give more importance about Unauthorized and Forbidden status codes to give more visibility to hacking attempts
const SUSPICIOUS_REQUEST_CODES = [401, 403];

export const logger = winston.createLogger({
  transports: [new winston.transports.Console({ level: LOG_LEVEL })],
  format: winston.format.combine(winston.format.json()),
});

const dynamicMeta: LoggerOptions['dynamicMeta'] = (req, res) => {
  const result: Record<string, unknown> = {
    status: res.statusCode,
    method: req.method,
    url: req.url,
  };
  const userId = req.auth?.userId;
  if (userId) {
    result.userId = userId;
  }
  return result;
};

/**
 * Logger for non 5xx, non suspicious requests e.g. 200, 204, 400...
 * - Requests are logged as info, expect for /healthz et and /change-env which are logged as debug
 * - No additional meta is logged
 * */
export const simpleLogger = expressWinston.logger({
  winstonInstance: logger,
  expressFormat: true,
  metaField: null,
  ignoreRoute: (_, res) =>
    res.statusCode >= 500 ||
    SUSPICIOUS_REQUEST_CODES.some((code) => code == res.statusCode),
  level: (req) =>
    ['/healthz', '/change-env'].includes(req.path) ? 'debug' : 'info',
  dynamicMeta,
  requestWhitelist: [],
  responseWhitelist: [],
});

/**
 * Logger for 5xx and suspicious requests.
 * - 5xx requests are logged as error, and suspicious requests are logged as warn
 * - The winston-express meta is logged
 */
export const detailedLogger = expressWinston.logger({
  winstonInstance: logger,
  expressFormat: true,
  metaField: null,
  ignoreRoute: (_, res) =>
    res.statusCode < 500 &&
    SUSPICIOUS_REQUEST_CODES.every((code) => res.statusCode != code),
  level: function (_, res) {
    if (SUSPICIOUS_REQUEST_CODES.includes(res.statusCode)) {
      return 'warn';
    }
    return 'error';
  },
  dynamicMeta,
});

export const uncaughtErrorLogger = expressWinston.errorLogger({
  winstonInstance: logger,
  metaField: null,
  dynamicMeta,
});

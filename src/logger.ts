import winston from 'winston';
import expressWinston, { LoggerOptions } from 'express-winston';
import { Request, Response } from 'express';

export const LOG_LEVEL = process.env.AUTH_LOG_LEVEL || 'info';

// * Create a common Winston logger that can be used in both middlewares and manually
export const logger = winston.createLogger({
  transports: [new winston.transports.Console({ level: LOG_LEVEL })],
  format: winston.format.combine(winston.format.json()),
});

// * Give more importance about Unauthorized and Forbidden status codes to give more visibility to hacking attempts
const SUSPICIOUS_REQUEST_CODES = [401, 403];
const isSimpleQuery = (_: Request, res: Response) =>
  res.statusCode < 500 &&
  SUSPICIOUS_REQUEST_CODES.every((code) => res.statusCode != code);

const commonLoggerOptions: LoggerOptions = {
  winstonInstance: logger,
  // * Put meta fields at the root of the logged object
  metaField: null,
  // * Always log status, method, url, and userId when it exists
  dynamicMeta: (req, res) => {
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
  },
};

/**
 * Logger for non 5xx, non suspicious requests e.g. 200, 204, 400...
 * - Requests are logged as info, expect for /healthz et and /change-env which are logged as debug
 * - No additional meta is logged
 * */
export const simpleLogger = expressWinston.logger({
  ...commonLoggerOptions,
  expressFormat: true,
  ignoreRoute: (...args) => !isSimpleQuery(...args),
  // * Flag /healthz and /change-env as debug, and everything else as info
  level: (req) =>
    ['/healthz', '/change-env'].includes(req.path) ? 'debug' : 'info',
  requestWhitelist: [],
  responseWhitelist: [],
});

/**
 * Logger for 5xx and suspicious requests.
 * - 5xx requests are logged as error, and suspicious requests are logged as warn
 * - The winston-express meta is logged
 */
export const detailedLogger = expressWinston.logger({
  ...commonLoggerOptions,
  expressFormat: true,
  ignoreRoute: isSimpleQuery,
  level: function (_, res) {
    // * Flag suspitious 4xx request as warn, and everything else as error
    if (SUSPICIOUS_REQUEST_CODES.includes(res.statusCode)) {
      return 'warn';
    }
    return 'error';
  },
});

export const uncaughtErrorLogger =
  expressWinston.errorLogger(commonLoggerOptions);

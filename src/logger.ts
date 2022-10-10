import winston from 'winston';
import expressWinston, { LoggerOptions } from 'express-winston';

export const LOG_LEVEL = process.env.AUTH_LOG_LEVEL || 'info';

// * Create a common Winston logger that can be used in both middlewares and manually
export const logger = winston.createLogger({
  transports: [new winston.transports.Console({ level: LOG_LEVEL })],
  format: winston.format.combine(winston.format.json()),
});

// * Give more importance to Unauthorized and Forbidden status codes to give more visibility to hacking attempts
const SUSPICIOUS_REQUEST_CODES = [401, 403];

const rewriteUrl = (url: string) => {
  if (LOG_LEVEL !== 'debug' && (url.includes('?') || url.includes('#'))) {
    const pathname = new URL(url, 'http://noop').pathname;
    return `${pathname}*****`;
  }
  return url;
};

const commonLoggerOptions: LoggerOptions = {
  winstonInstance: logger,
  // * Put meta fields at the root of the logged object
  metaField: null,
  // * Always log status, method, url, and userId when it exists
  dynamicMeta: (req, res) => {
    const result: Record<string, unknown> = {
      status: res.statusCode,
      method: req.method,
    };
    if (LOG_LEVEL === 'debug') {
      result.headers = req.headers;
      result.url = req.url;
    } else {
      result.url = rewriteUrl(req.url);
    }
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
export const httpLogger = expressWinston.logger({
  ...commonLoggerOptions,
  msg: (req, res) =>
    `${req.method} ${rewriteUrl(req.url)} ${res.statusCode} ${
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (res as any).responseTime
    }ms`,
  // * Flag /healthz and /change-env as debug, and everything else as info
  level: (req, res) => {
    if (['/healthz', '/change-env'].includes(req.path)) return 'debug';
    if (SUSPICIOUS_REQUEST_CODES.includes(res.statusCode)) {
      return 'warn';
    }
    if (res.statusCode >= 500) {
      return 'error';
    }
    return 'info';
  },

  requestWhitelist: [],
  responseWhitelist: [],
});

export const uncaughtErrorLogger =
  expressWinston.errorLogger(commonLoggerOptions);

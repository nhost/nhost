import winston from 'winston';
import expressWinston, { LoggerOptions } from 'express-winston';
import { Response } from 'express';
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
    const char = url.includes('?') ? '?' : '#';
    return `${pathname}${char}*****`;
  }
  return url;
};

const loggerOptions: LoggerOptions = {
  winstonInstance: logger,
  // * Put meta fields at the root of the logged object
  metaField: null,
  responseField: null,
  msg: (req, res) =>
    `${req.method} ${rewriteUrl(req.url)} ${res.statusCode} ${
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (res as any).responseTime
    }ms`,
  // * Always log status, method, url, and userId when it exists
  dynamicMeta: ({ method, url, auth, headers }, res) => {
    const { responseTime, statusCode } = res as Response & {
      responseTime: number;
    };
    const meta: Record<string, unknown> = {
      statusCode,
      method,
      latencyInNs: responseTime * 1e6,
    };
    if (LOG_LEVEL === 'debug') {
      meta.url = url;
      meta.headers = headers;
    } else {
      meta.url = rewriteUrl(url);
    }
    const userId = auth?.userId;
    if (userId) {
      meta.userId = userId;
    }
    return meta;
  },
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
  responseWhitelist: ['responseTime'],
};

/**
 * Logger for non 5xx, non suspicious requests e.g. 200, 204, 400...
 * - Requests are logged as info, expect for /healthz et and /change-env which are logged as debug
 * - No additional meta is logged
 * */
export const httpLogger = expressWinston.logger(loggerOptions);

export const uncaughtErrorLogger = expressWinston.errorLogger(loggerOptions);

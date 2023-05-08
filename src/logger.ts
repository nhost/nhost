import { Response } from 'express';
import expressWinston, { LoggerOptions } from 'express-winston';
import winston from 'winston';
import { ENV } from './utils/env';
export const LOG_LEVEL = process.env.AUTH_LOG_LEVEL || 'info';

// * Create a common Winston logger that can be used in both middlewares and manually
export const logger = winston.createLogger({
  transports: [new winston.transports.Console({ level: LOG_LEVEL })],
  format: winston.format.combine(winston.format.json()),
});

// * Give more importance to Unauthorized and Forbidden status codes to give more visibility to hacking attempts
const SUSPICIOUS_REQUEST_CODES = [401, 403];

const maskUrl = (url: string) => {
  if (
    ENV.AUTH_SHOW_LOG_QUERY_PARAMS ||
    LOG_LEVEL === 'debug' ||
    (!url.includes('?') && !url.includes('#'))
  ) {
    return url;
  }

  const { pathname, searchParams, hash } = new URL(url, 'http://noop');
  const queryParameters = Array.from(searchParams.keys());

  if (queryParameters.length > 0) {
    return `${pathname}?${queryParameters
      .map((param) => `${param}=*****`)
      .join('&')}`;
  }

  if (hash) {
    return `${pathname}#*****`;
  }

  return pathname;
};

const maskHeaders = (headers: Record<string, unknown>) => {
  if (LOG_LEVEL === 'DEBUG') {
    return headers;
  }

  return Object.keys(headers).reduce(
    (returnableHeaders, key) => ({
      ...returnableHeaders,
      [key]: '*****',
    }),
    {}
  );
};

const loggerOptions: LoggerOptions = {
  winstonInstance: logger,
  // * Put meta fields at the root of the logged object
  metaField: null,
  responseField: null,
  msg: (req, res) =>
    `${req.method} ${maskUrl(req.url)} ${res.statusCode} ${
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (res as any).responseTime
    }ms`,
  // * Always log status, method, url, and userId when it exists
  dynamicMeta: ({ method, url, auth, headers }, res) => {
    const { responseTime, statusCode, body } = res as Response & {
      responseTime: number;
      body: unknown;
    };

    const meta: Record<string, unknown> = {
      statusCode,
      method,
      latencyInNs: responseTime * 1e6,
    };

    if (statusCode >= 400) {
      meta.reason = body;
    }

    if (LOG_LEVEL === 'debug') {
      meta.url = url;
      meta.headers = headers;
    } else {
      meta.url = maskUrl(url);
      meta.headers = maskHeaders(headers);
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
  responseWhitelist: ['responseTime', 'body'],
};

/**
 * Logger for non 5xx, non suspicious requests e.g. 200, 204, 400...
 * - Requests are logged as info, expect for /healthz et and /change-env which are logged as debug
 * - No additional meta is logged
 * */
export const httpLogger = expressWinston.logger(loggerOptions);

export const uncaughtErrorLogger = expressWinston.errorLogger(loggerOptions);

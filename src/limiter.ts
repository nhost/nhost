import { APPLICATION } from '@config/index';
import rateLimit, { Message } from 'express-rate-limit';

/**
 * In order to stay consistent with the error message
 * format used in `src/utils/errors.ts`, the `Message`
 * interface from `express-rate-limit` is extended to
 * include the `statusCode` property.
 */
interface LimitMessage extends Message {
  statusCode: number;
  message: string;
  [key: string]: unknown;
}

export const limiter = rateLimit({
  headers: true,

  max: APPLICATION.MAX_REQUESTS,
  windowMs: APPLICATION.TIME_FRAME,
  skip: ({ path }) => {
    // Don't limit health checks. See https://github.com/nhost/hasura-auth/issues/175
    if (path === '/healthz') return true;
    return false;
  },
  /**
   * To use the above created interface, an `unknown`
   * conversion for non-overlapping types is necessary.
   */
  message: {
    statusCode: 429,
    error: 'Too Many Requests',
    message: 'You are being rate limited',
  } as unknown as LimitMessage,
});

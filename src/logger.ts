import pinoLogger from 'express-pino-logger';
import { ENV } from './utils/env';

const pino = pinoLogger({
  autoLogging: {
    ignorePaths: ['/healthz', '/change-env'],
  },
  level: ENV.AUTH_LOG_LEVEL,
});

const logger = pino.logger;

export { pino, logger };

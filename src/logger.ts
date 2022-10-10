import pinoLogger from 'express-pino-logger';
export const LOG_LEVEL = process.env.AUTH_LOG_LEVEL || 'info';

const pino = pinoLogger({
  autoLogging: {
    ignorePaths: ['/healthz', '/change-env'],
  },
  level: 'silent',
});

const logger = pino.logger;

export { pino, logger };

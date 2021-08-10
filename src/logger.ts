import winston from 'winston';
import { ENV } from './utils/env';

const logger = winston.createLogger({
  transports: [new winston.transports.Console()],
  format:
    process.env.NODE_ENV === 'production'
      ? winston.format.json()
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        ),
  exitOnError: false,
  level: ENV.LOGGER_LEVEL,
  silent: !ENV.LOGGER_ENABLED,
});

export default logger;

import { APPLICATION } from '@config/application';
import winston from 'winston';

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
  level: APPLICATION.LOGGER_LEVEL,
  silent: !APPLICATION.LOGGER_ENABLED,
});

export default logger;

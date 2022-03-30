import express from 'express';
import helmet from 'helmet';
import { json } from 'body-parser';
import cors from 'cors';
import passport from 'passport';
import { Server } from 'http';

import { ENV, waitForHasura } from '@/utils';
import { applyMigrations } from './migrations';
import { applyMetadata } from './metadata';
import router from './routes';
import { serverErrors } from './errors';
import { authMiddleware } from './middleware/auth';
import { pino, logger, LOG_LEVEL } from './logger';
import { addOpenApiRoute } from './openapi';

const app = express();

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

addOpenApiRoute(app);

app.use(pino);
app.use(helmet());
app.use(json());
app.use(cors());

app.use(authMiddleware);

app.use(passport.initialize());

app.use(router);
app.use(serverErrors);

export { app };

export const start = async (): Promise<Server> => {
  // wait for hasura to be ready
  await waitForHasura();
  // apply migrations and metadata
  await applyMigrations();
  await applyMetadata();

  return new Promise((resolve) => {
    const server = app.listen(ENV.AUTH_PORT, ENV.AUTH_HOST, () => {
      logger.info('Log level');
      logger.info(LOG_LEVEL);
      if (ENV.AUTH_HOST) {
        logger.info(`Running on http://${ENV.AUTH_HOST}:${ENV.AUTH_PORT}`);
      } else {
        logger.info(`Running on port ${ENV.AUTH_PORT}`);
      }
      return resolve(server);
    });
  });
};

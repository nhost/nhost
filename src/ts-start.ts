import axios from 'axios';

import { app } from './server';
import { applyMigrations } from '@/migrations';
import { applyMetadata } from '@/metadata';
import './env-vars-check';
import { ENV } from './utils/env';
import { logger } from './logger';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const getHasuraReadyState = async () => {
  try {
    await axios.get(
      `${ENV.HASURA_GRAPHQL_GRAPHQL_URL.replace('/v1/graphql', '/healthz')}`
    );
    return true;
  } catch (err) {
    return false;
  }
};

const waitForHasura = async () => {
  let hasuraIsReady = false;

  while (!hasuraIsReady) {
    hasuraIsReady = await getHasuraReadyState();

    if (hasuraIsReady) {
      logger.info('Hasura is ready');
    } else {
      logger.info('Hasura is not ready. Retry in 5 seconds.');
      await delay(5000);
    }
  }
};

const start = async (): Promise<void> => {
  // wait for hasura to be ready
  await waitForHasura();

  // apply migrations and metadata
  await applyMigrations();
  await applyMetadata();

  app.listen(ENV.AUTH_PORT, ENV.AUTH_HOST, () => {
    logger.info('Log level');
    logger.info(ENV.AUTH_LOG_LEVEL);
    if (ENV.AUTH_HOST) {
      logger.info(`Running on http://${ENV.AUTH_HOST}:${ENV.AUTH_PORT}`);
    } else {
      logger.info(`Running on port ${ENV.AUTH_PORT}`);
    }
  });
};

start();

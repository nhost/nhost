import { APPLICATION } from '@config/index';
import axios from 'axios';

import { app } from './server';
import { applyMigrations } from '@/migrations';
import { applyMetadata } from '@/metadata';
import './env-vars-check';
import logger from './logger';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const getHasuraReadyState = async () => {
  try {
    await axios.get(
      `${APPLICATION.HASURA_ENDPOINT.replace('/v1/graphql', '/healthz')}`
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
      console.log('Hasura is ready');
    } else {
      console.log('Hasura is not ready. Retry in 5 seconds.');
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

  app.listen(APPLICATION.PORT, APPLICATION.HOST, () => {
    if (APPLICATION.HOST) {
      logger.info(`Running on http://${APPLICATION.HOST}:${APPLICATION.PORT}`);
    } else {
      logger.info(`Running on port ${APPLICATION.PORT}`);
    }
  });
};

start();

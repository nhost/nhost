import { logger } from '../logger';
import axios from 'axios';
import { ENV } from './env';

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

export const waitForHasura = async () => {
  let hasuraIsReady = false;

  logger.info('Waiting for Hasura to be ready...');
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

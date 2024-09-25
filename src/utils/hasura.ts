import { logger } from '../logger';
import axios, { AxiosError } from 'axios';
import { ENV } from './env';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const reachHasura = async () => {
  try {
    await axios.get(
      `${ENV.HASURA_GRAPHQL_GRAPHQL_URL.replace('/v1/graphql', '/hasura/healthz')}`
    );
  } catch (err) {
    const { message } = err as AxiosError;
    logger.info(`Hasura is not ready. Retry in 5 seconds: ${message}`);
    await delay(5000);
    await reachHasura();
  }
};

export const waitForHasura = async () => {
  logger.info('Waiting for Hasura to be ready...');
  await reachHasura();
  logger.info('Hasura is ready');
};

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

const getIsFirstRound = async () => {
  // https://stackoverflow.com/a/24089729
  const { data } = await axios.post(
    APPLICATION.HASURA_ENDPOINT.replace('/v1/graphql', '/v2/query'),
    {
      type: 'run_sql',
      args: {
        source: 'default',
        sql: "SELECT to_regclass('auth.users');",
      },
    },
    {
      headers: {
        'x-hasura-admin-secret': APPLICATION.HASURA_GRAPHQL_ADMIN_SECRET,
      },
    }
  );

  const isFirstRound = data.result[1][0] === 'NULL';

  return isFirstRound;
};

const start = async (): Promise<void> => {
  // wait for hasura to be ready
  await waitForHasura();

  // Check if metadata should be applied or not.
  // Metadata should be applied in dev mode or on first run in production.
  // In production, on subsequent runs, metadata should be applied by the
  // developer
  const metadataShouldBeApplied =
    process.env.NODE_ENV === 'development' || (await getIsFirstRound());

  // apply migrations
  await applyMigrations();

  if (metadataShouldBeApplied) {
    await applyMetadata();
  }

  app.listen(APPLICATION.PORT, APPLICATION.HOST, () => {
    if (APPLICATION.HOST) {
      logger.info(`Running on http://${APPLICATION.HOST}:${APPLICATION.PORT}`);
    } else {
      logger.info(`Running on port ${APPLICATION.PORT}`);
    }
  });
};

start();

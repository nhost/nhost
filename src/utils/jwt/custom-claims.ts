import { jsonToGraphQLQuery, VariableType } from 'json-to-graphql-query';
import { set } from 'dot-prop';
import jsonata from 'jsonata';

import { ENV } from '../env';
import { client } from '../gqlSDK';
import { logger } from '@/logger';

/**
 * Convert array to Postgres array
 * @param arr js array to be converted to Postgres array
 */
function toPgArray(arr: string[]): string {
  const m = arr.map((e) => `"${e}"`).join(',');
  return `{${m}}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const escapeValueToPg = (value: any): string => {
  // ? Why escaping values? See:
  // * https://hasura.io/docs/latest/graphql/core/auth/authorization/roles-variables.html#format-of-session-variables
  // * https://github.com/hasura/graphql-engine/issues/1902
  const type = typeof value;
  if (type === 'string') {
    return value;
  } else if (Array.isArray(value)) {
    return toPgArray(value);
  } else {
    return JSON.stringify(value ?? null);
  }
};

const createCustomFieldQuery = (jwtFields: Record<string, string>): string => {
  const fields = Object.values(jwtFields).reduce<Record<string, unknown>>(
    (aggr, path) => {
      set(aggr, path, true);
      return aggr;
    },
    {}
  );
  const query = {
    query: {
      __variables: {
        userId: 'uuid!',
      },
      user: {
        __args: {
          id: new VariableType('userId'),
        },
        ...fields,
      },
    },
  };
  return jsonToGraphQLQuery(query);
};

export const generateCustomClaims = async (userId: string) => {
  if (Object.keys(ENV.AUTH_JWT_CUSTOM_CLAIMS).length === 0) return {};
  const request = createCustomFieldQuery(ENV.AUTH_JWT_CUSTOM_CLAIMS);
  try {
    const {
      data: { user },
    } = await client.rawRequest(request, {
      userId,
    });

    return Object.entries(ENV.AUTH_JWT_CUSTOM_CLAIMS).reduce<
      Record<string, unknown>
    >((aggr, [name, path]) => {
      const expression = jsonata(path);
      try {
        const jsonataValue = escapeValueToPg(
          expression.evaluate(user, expression)
        );
        aggr[`x-hasura-${name}`] = jsonataValue;
      } catch {
        logger.warn(`Invalid JSONata expression`, { user, expression });
        aggr[`x-hasura-${name}`] = null;
      }
      return aggr;
    }, {});
  } catch {
    logger.warn(`Invalid custom JWT GraphQL Query`, { request });
    return {};
  }
};

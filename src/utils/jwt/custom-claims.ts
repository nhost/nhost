import { jsonToGraphQLQuery, VariableType } from 'json-to-graphql-query';
import { set } from 'dot-prop';

import { get } from 'dot-prop';
import { ENV } from '../env';
import { client } from '../gqlSDK';

/**
 * Convert array to Postgres array
 * @param arr js array to be converted to Postgres array
 */
function toPgArray(arr: string[]): string {
  const m = arr.map((e) => `"${e}"`).join(',');
  return `{${m}}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const escapeValueToPg = (value: any): string => {
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
  return jsonToGraphQLQuery(query, { pretty: true });
};

export const generateCustomClaims = async (userId: string) => {
  if (Object.keys(ENV.AUTH_JWT_CUSTOM_CLAIMS).length === 0) return {};
  const {
    data: { user },
  } = await client.rawRequest(
    createCustomFieldQuery(ENV.AUTH_JWT_CUSTOM_CLAIMS),
    {
      userId,
    }
  );

  return Object.entries(ENV.AUTH_JWT_CUSTOM_CLAIMS).reduce<
    Record<string, unknown>
  >((aggr, [name, path]) => {
    aggr[`x-hasura-${name}`] = escapeValueToPg(get(user, path));
    return aggr;
  }, {});
};

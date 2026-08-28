import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import type { NhostClient } from '@nhost/nhost-js';
import { print } from 'graphql';

/**
 * Runs a typed GraphQL operation through the Nhost client and unwraps the
 * result, throwing on GraphQL errors so callers can rely on the data shape.
 */
export async function gqlRequest<TResult, TVariables>(
  client: NhostClient,
  document: TypedDocumentNode<TResult, TVariables>,
  variables: TVariables,
): Promise<TResult> {
  const { body } = await client.graphql.request<TResult, TVariables>({
    query: print(document),
    variables,
  });

  if (body.errors?.length) {
    throw new Error(body.errors.map(({ message }) => message).join('\n'));
  }

  if (body.data === undefined) {
    throw new Error('The GraphQL response did not include data.');
  }

  return body.data;
}

import type { GraphQLError } from '@nhost/nhost-js/graphql';

// Everything the app does over GraphQL depends on the permissions in
// nhost/metadata, and the symptom of those not having been applied is a schema
// without the field.
const NOT_APPLIED =
  'The backend has no permission for this yet: nhost/metadata is applied by nhost up.';

export function graphqlErrorMessage(
  errors: GraphQLError[] | undefined,
): string {
  const message = errors?.[0]?.message;

  if (message?.includes('not found in type')) {
    return NOT_APPLIED;
  }

  return message ?? 'The backend did not answer.';
}

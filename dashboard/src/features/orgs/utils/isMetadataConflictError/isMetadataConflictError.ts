import type { ApolloError } from '@apollo/client';

const METADATA_CONFLICT_PATTERN =
  /^metadata resource version referenced \(\d+\) did not match current version$/;

export default function isMetadataConflictError(
  error: ApolloError | Error,
): boolean {
  return (
    error instanceof Error && METADATA_CONFLICT_PATTERN.test(error.message)
  );
}

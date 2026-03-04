import { validate as uuidValidate } from 'uuid';

export function buildFilesWhereClause({
  searchString,
  bucketId,
}: {
  searchString?: string;
  bucketId?: string;
}) {
  const searchFilter = searchString
    ? {
        _or: [
          ...((uuidValidate(searchString) && [{ id: { _eq: searchString } }]) ||
            []),
          { name: { _ilike: `%${searchString}%` } },
        ],
      }
    : null;

  const bucketFilter = bucketId ? { bucketId: { _eq: bucketId } } : null;

  if (searchFilter && bucketFilter) {
    return { _and: [searchFilter, bucketFilter] };
  }

  return searchFilter || bucketFilter;
}

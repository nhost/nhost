import { selectNativeQueries } from '@/features/orgs/projects/database/native-queries/hooks/useGetNativeQueries';
import type { ExportMetadataResponse } from '@/utils/hasura-api/generated/schemas';

const response = (sources: ExportMetadataResponse['metadata']['sources']) =>
  ({ resource_version: 1, metadata: { version: 3, sources } }) as ExportMetadataResponse;

const query = {
  root_field_name: 'authors',
  code: 'SELECT * FROM authors',
  returns: 'author_result',
};

describe('selectNativeQueries', () => {
  it('selects native queries from only the default source', () => {
    expect(
      selectNativeQueries(
        response([
          { name: 'other', kind: 'postgres', native_queries: [{ ...query, root_field_name: 'ignored' }] },
          { name: 'default', kind: 'postgres', native_queries: [query] },
        ]),
      ),
    ).toEqual([query]);
  });

  it.each([
    { sources: [] },
    { sources: [{ name: 'default', kind: 'postgres' }] },
  ])('returns an empty array when metadata is absent', ({ sources }) => {
    expect(selectNativeQueries(response(sources))).toEqual([]);
  });
});

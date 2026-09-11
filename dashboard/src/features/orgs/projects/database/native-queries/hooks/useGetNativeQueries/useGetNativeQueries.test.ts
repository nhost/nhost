import { selectNativeQueries } from '@/features/orgs/projects/database/native-queries/hooks/useGetNativeQueries';
import type { ExportMetadataResponse } from '@/utils/hasura-api/generated/schemas';

const response = (
  metadataSources: ExportMetadataResponse['metadata']['sources'],
) =>
  ({
    resource_version: 1,
    metadata: { version: 3, sources: metadataSources },
  }) as ExportMetadataResponse;

const defaultQuery = {
  root_field_name: 'authors',
  code: 'SELECT id FROM authors',
  returns: 'author_result',
};
const analyticsQuery = {
  root_field_name: 'authors',
  code: 'SELECT invoice_id FROM authors',
  returns: 'invoice_result',
};
const sources = [
  {
    name: 'default',
    kind: 'postgres',
    native_queries: [defaultQuery],
  },
  {
    name: 'analytics',
    kind: 'postgres',
    native_queries: [analyticsQuery],
  },
  {
    name: 'warehouse',
    kind: 'mssql',
    native_queries: [{ ...defaultQuery, code: 'SELECT unsupported' }],
  },
] as ExportMetadataResponse['metadata']['sources'];

describe('selectNativeQueries', () => {
  it.each([
    ['default', defaultQuery],
    ['analytics', analyticsQuery],
  ])('selects same-named queries only from %s', (source, query) => {
    expect(selectNativeQueries(response(sources), source)).toEqual([query]);
  });

  it.each([
    'missing',
    'warehouse',
  ])('does not fall back for unavailable source %s', (source) => {
    expect(selectNativeQueries(response(sources), source)).toEqual([]);
  });

  it('returns an empty array when the source has no native queries', () => {
    expect(
      selectNativeQueries(
        response([{ name: 'default', kind: 'postgres' }]),
        'default',
      ),
    ).toEqual([]);
  });
});

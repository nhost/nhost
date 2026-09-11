import { selectLogicalModels } from '@/features/orgs/projects/database/native-queries/hooks/useGetLogicalModels';
import type { ExportMetadataResponse } from '@/utils/hasura-api/generated/schemas';

const response = (
  metadataSources: ExportMetadataResponse['metadata']['sources'],
) =>
  ({
    resource_version: 1,
    metadata: { version: 3, sources: metadataSources },
  }) as ExportMetadataResponse;

const defaultModel = {
  name: 'result',
  fields: [{ name: 'id', type: { scalar: 'text' } }],
};
const analyticsModel = {
  name: 'result',
  fields: [{ name: 'invoice_id', type: { scalar: 'uuid' } }],
};
const sources = [
  {
    name: 'default',
    kind: 'postgres',
    logical_models: [defaultModel],
  },
  {
    name: 'analytics',
    kind: 'postgres',
    logical_models: [analyticsModel],
  },
  {
    name: 'warehouse',
    kind: 'mssql',
    logical_models: [{ name: 'result', fields: [] }],
  },
] as ExportMetadataResponse['metadata']['sources'];

describe('selectLogicalModels', () => {
  it.each([
    ['default', defaultModel],
    ['analytics', analyticsModel],
  ])('selects same-named models only from %s', (source, model) => {
    expect(selectLogicalModels(response(sources), source)).toEqual([model]);
  });

  it.each([
    'missing',
    'warehouse',
  ])('does not fall back for unavailable source %s', (source) => {
    expect(selectLogicalModels(response(sources), source)).toEqual([]);
  });

  it('returns an empty array when the source has no logical models', () => {
    expect(
      selectLogicalModels(
        response([{ name: 'default', kind: 'postgres' }]),
        'default',
      ),
    ).toEqual([]);
  });
});

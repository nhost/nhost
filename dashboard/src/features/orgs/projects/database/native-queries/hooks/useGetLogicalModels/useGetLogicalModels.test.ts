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
  { name: 'default', logical_models: [defaultModel] },
  { name: 'analytics', logical_models: [analyticsModel] },
] as ExportMetadataResponse['metadata']['sources'];

describe('selectLogicalModels', () => {
  it.each([
    ['default', defaultModel],
    ['analytics', analyticsModel],
  ])('selects same-named models only from %s', (source, model) => {
    expect(selectLogicalModels(response(sources), source)).toEqual([model]);
  });

  it('does not fall back for an unavailable source', () => {
    expect(selectLogicalModels(response(sources), 'missing')).toEqual([]);
  });

  it('returns an empty array when the source has no logical models', () => {
    expect(
      selectLogicalModels(response([{ name: 'default' }]), 'default'),
    ).toEqual([]);
  });
});

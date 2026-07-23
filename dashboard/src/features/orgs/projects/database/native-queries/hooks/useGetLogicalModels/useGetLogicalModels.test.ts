import type { ExportMetadataResponse } from '@/utils/hasura-api/generated/schemas';
import { selectLogicalModels } from '@/features/orgs/projects/database/native-queries/hooks/useGetLogicalModels';

const response = (sources: ExportMetadataResponse['metadata']['sources']) =>
  ({ resource_version: 1, metadata: { version: 3, sources } }) as ExportMetadataResponse;

describe('selectLogicalModels', () => {
  it('selects logical models from only the default source', () => {
    const model = { name: 'result', fields: [] };
    expect(
      selectLogicalModels(
        response([
          { name: 'other', kind: 'postgres', logical_models: [{ name: 'ignored', fields: [] }] },
          { name: 'default', kind: 'postgres', logical_models: [model] },
        ]),
      ),
    ).toEqual([model]);
  });

  it.each([
    { sources: [] },
    { sources: [{ name: 'default', kind: 'postgres' }] },
  ])('returns an empty array when metadata is absent', ({ sources }) => {
    expect(selectLogicalModels(response(sources))).toEqual([]);
  });
});

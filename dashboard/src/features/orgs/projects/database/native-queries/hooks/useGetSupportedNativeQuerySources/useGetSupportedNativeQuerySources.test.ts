import { selectSupportedNativeQuerySources } from '@/features/orgs/projects/database/native-queries/hooks/useGetSupportedNativeQuerySources';
import type { ExportMetadataResponse } from '@/utils/hasura-api/generated/schemas';

const response = (
  sources: ExportMetadataResponse['metadata']['sources'],
): ExportMetadataResponse =>
  ({
    resource_version: 1,
    metadata: { version: 3, sources },
  }) as ExportMetadataResponse;

describe('selectSupportedNativeQuerySources', () => {
  it('returns only named PostgreSQL sources without changing metadata order', () => {
    expect(
      selectSupportedNativeQuerySources(
        response([
          { name: 'analytics', kind: 'postgres' },
          { name: 'warehouse', kind: 'mssql' },
          { name: 'default', kind: 'postgres' },
        ]),
      ),
    ).toEqual(['analytics', 'default']);
  });

  it('returns an empty list when metadata has no supported sources', () => {
    expect(
      selectSupportedNativeQuerySources(
        response([{ name: 'warehouse', kind: 'mssql' }]),
      ),
    ).toEqual([]);
  });
});

import { vi } from 'vitest';
import { renderHook } from '@/tests/testUtils';
import type { ExportMetadataResponseMetadata } from '@/utils/hasura-api/generated/schemas';
import useMetadataTables from './useMetadataTables';

const mocks = vi.hoisted(() => ({
  useGetMetadata: vi.fn(),
}));

vi.mock('@/features/orgs/projects/common/hooks/useGetMetadata', () => ({
  useGetMetadata: mocks.useGetMetadata,
}));

function renderWithMetadata(
  metadata: ExportMetadataResponseMetadata | undefined,
) {
  mocks.useGetMetadata.mockReturnValue({ data: metadata });
  return renderHook(() => useMetadataTables());
}

describe('useMetadataTables', () => {
  afterEach(() => vi.restoreAllMocks());

  it('flattens every source/table into source/schema/table entries', () => {
    const { result } = renderWithMetadata({
      version: 3,
      sources: [
        {
          name: 'default',
          tables: [
            { table: { schema: 'public', name: 'users' } },
            { table: { schema: 'public', name: 'todos' } },
            { table: { schema: 'auth', name: 'providers' } },
          ],
        },
        {
          name: 'secondary',
          tables: [{ table: { schema: 'public', name: 'orders' } }],
        },
      ],
    } as ExportMetadataResponseMetadata);

    expect(result.current).toEqual([
      { source: 'default', schema: 'public', table: 'users' },
      { source: 'default', schema: 'public', table: 'todos' },
      { source: 'default', schema: 'auth', table: 'providers' },
      { source: 'secondary', schema: 'public', table: 'orders' },
    ]);
  });

  it('treats a source without tables as contributing no entries', () => {
    const { result } = renderWithMetadata({
      version: 3,
      sources: [
        { name: 'default' },
        {
          name: 'secondary',
          tables: [{ table: { schema: 'public', name: 'orders' } }],
        },
      ],
    } as ExportMetadataResponseMetadata);

    expect(result.current).toEqual([
      { source: 'secondary', schema: 'public', table: 'orders' },
    ]);
  });

  it('returns an empty array when metadata or sources are missing', () => {
    expect(renderWithMetadata(undefined).result.current).toEqual([]);
    expect(
      renderWithMetadata({ version: 3 } as ExportMetadataResponseMetadata)
        .result.current,
    ).toEqual([]);
  });
});

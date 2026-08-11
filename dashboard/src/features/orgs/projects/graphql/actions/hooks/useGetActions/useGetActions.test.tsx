import { vi } from 'vitest';
import { renderHook } from '@/tests/testUtils';
import type { ExportMetadataResponse } from '@/utils/hasura-api/generated/schemas';
import useGetActions from './useGetActions';

const mocks = vi.hoisted(() => ({
  useExportMetadata: vi.fn(),
}));

vi.mock('@/features/orgs/projects/common/hooks/useExportMetadata', () => ({
  useExportMetadata: mocks.useExportMetadata,
}));

type SelectFn = (data: ExportMetadataResponse) => unknown;

describe('useGetActions', () => {
  afterEach(() => vi.restoreAllMocks());

  function getSelect(): SelectFn {
    mocks.useExportMetadata.mockReturnValue({ data: undefined });
    renderHook(() => useGetActions());
    return mocks.useExportMetadata.mock.calls[0][0] as SelectFn;
  }

  it('maps metadata actions and custom types into the slice', () => {
    const select = getSelect();
    const actions = [
      { name: 'login', definition: { handler: 'h', output_type: 'O' } },
    ];
    const customTypes = { objects: [{ name: 'O', fields: [] }] };

    expect(
      select({
        resource_version: 1,
        metadata: { version: 3, actions, custom_types: customTypes },
      } as ExportMetadataResponse),
    ).toEqual({ actions, customTypes });
  });

  it('defaults to an empty list and object when metadata is missing them', () => {
    const select = getSelect();

    expect(
      select({
        resource_version: 1,
        metadata: { version: 3 },
      } as ExportMetadataResponse),
    ).toEqual({ actions: [], customTypes: {} });
  });
});

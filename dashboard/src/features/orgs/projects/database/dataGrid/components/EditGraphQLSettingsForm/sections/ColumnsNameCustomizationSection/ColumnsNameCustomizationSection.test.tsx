import { vi } from 'vitest';
import { render, screen, TestUserEvent } from '@/tests/testUtils';
import ColumnsNameCustomizationSection from './ColumnsNameCustomizationSection';

const mocks = vi.hoisted(() => ({
  useTableCustomizationQuery: vi.fn(),
  useSetTableCustomizationMutation: vi.fn(),
  useGetMetadataResourceVersion: vi.fn(),
  useTableSchemaQuery: vi.fn(),
}));

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useTableCustomizationQuery',
  () => ({
    useTableCustomizationQuery: mocks.useTableCustomizationQuery,
  }),
);

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useSetTableCustomizationMutation',
  () => ({
    useSetTableCustomizationMutation: mocks.useSetTableCustomizationMutation,
  }),
);

vi.mock(
  '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion',
  () => ({
    useGetMetadataResourceVersion: mocks.useGetMetadataResourceVersion,
  }),
);

vi.mock(
  '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery',
  () => ({
    useTableSchemaQuery: mocks.useTableSchemaQuery,
  }),
);

describe('ColumnsNameCustomizationSection', () => {
  beforeEach(() => {
    mocks.useTableCustomizationQuery.mockReturnValue({
      data: { column_config: { id: { custom_name: '' } } },
      isLoading: false,
      refetch: vi.fn(),
    });
    mocks.useSetTableCustomizationMutation.mockReturnValue({
      mutateAsync: vi.fn(),
    });
    mocks.useGetMetadataResourceVersion.mockReturnValue({ data: 1 });
    mocks.useTableSchemaQuery.mockReturnValue({
      data: {
        columns: [
          { column_name: 'id', data_type: 'uuid', full_data_type: 'uuid' },
        ],
      },
      isLoading: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('reports dirty state through onDirtyChange when a field is edited and on unmount', async () => {
    const user = new TestUserEvent();
    const onDirtyChange = vi.fn();
    const { unmount } = render(
      <ColumnsNameCustomizationSection
        schema="public"
        tableName="user_profile"
        onDirtyChange={onDirtyChange}
      />,
    );

    expect(onDirtyChange).not.toHaveBeenCalledWith(true);

    const fieldNameInput = screen.getByPlaceholderText('id (default)');
    await user.type(fieldNameInput, 'identifier');

    expect(onDirtyChange).toHaveBeenCalledWith(true);

    onDirtyChange.mockClear();
    unmount();

    expect(onDirtyChange).toHaveBeenCalledWith(false);
  });
});

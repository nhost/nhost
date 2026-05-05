import { vi } from 'vitest';
import { render, screen, TestUserEvent } from '@/tests/testUtils';
import ColumnsNameCustomizationSection from './ColumnsNameCustomizationSection';

const mocks = vi.hoisted(() => ({
  useTableCustomizationQuery: vi.fn(),
  useSetTableCustomizationMutation: vi.fn(),
  useGetMetadataResourceVersion: vi.fn(),
  useTableSchemaQuery: vi.fn(),
}));

const dialogMocks = vi.hoisted(() => ({
  setDirtySource: vi.fn(),
}));

vi.mock('@/components/common/DialogProvider', async () => {
  const actual = await vi.importActual<
    typeof import('@/components/common/DialogProvider')
  >('@/components/common/DialogProvider');
  return {
    ...actual,
    useDialog: () => ({
      setDirtySource: dialogMocks.setDirtySource,
      onDirtyStateChange: vi.fn(),
      openDialog: vi.fn(),
      openDrawer: vi.fn(),
      openAlertDialog: vi.fn(),
      closeDialog: vi.fn(),
      closeDrawer: vi.fn(),
      closeDialogWithDirtyGuard: vi.fn(),
      closeDrawerWithDirtyGuard: vi.fn(),
      closeAlertDialog: vi.fn(),
      openDirtyConfirmation: vi.fn(),
    }),
  };
});

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

  it('reports dirty state through setDirtySource when a field is edited and on unmount', async () => {
    const user = new TestUserEvent();
    const { unmount } = render(
      <ColumnsNameCustomizationSection
        schema="public"
        tableName="user_profile"
      />,
    );

    expect(dialogMocks.setDirtySource).not.toHaveBeenCalledWith(
      'edit-gql-columns',
      true,
    );

    const fieldNameInput = screen.getByPlaceholderText('id (default)');
    await user.type(fieldNameInput, 'identifier');

    expect(dialogMocks.setDirtySource).toHaveBeenCalledWith(
      'edit-gql-columns',
      true,
    );

    dialogMocks.setDirtySource.mockClear();
    unmount();

    expect(dialogMocks.setDirtySource).toHaveBeenCalledWith(
      'edit-gql-columns',
      false,
    );
  });
});

import { vi } from 'vitest';
import { render, screen, TestUserEvent } from '@/tests/testUtils';
import SetIsEnumSection from './SetIsEnumSection';

const mocks = vi.hoisted(() => ({
  useTableIsEnumQuery: vi.fn(),
  useSetTableIsEnumMutation: vi.fn(),
  useGetMetadataResourceVersion: vi.fn(),
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
  '@/features/orgs/projects/database/dataGrid/hooks/useTableIsEnumQuery',
  () => ({
    useTableIsEnumQuery: mocks.useTableIsEnumQuery,
  }),
);

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useSetTableIsEnumMutation',
  () => ({
    useSetTableIsEnumMutation: mocks.useSetTableIsEnumMutation,
  }),
);

vi.mock(
  '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion',
  () => ({
    useGetMetadataResourceVersion: mocks.useGetMetadataResourceVersion,
  }),
);

describe('SetIsEnumSection', () => {
  beforeEach(() => {
    mocks.useTableIsEnumQuery.mockReturnValue({
      data: false,
      isLoading: false,
      refetch: vi.fn(),
    });
    mocks.useSetTableIsEnumMutation.mockReturnValue({
      mutateAsync: vi.fn(),
    });
    mocks.useGetMetadataResourceVersion.mockReturnValue({ data: 1 });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('reports dirty state through setDirtySource when the switch is toggled and on unmount', async () => {
    const user = new TestUserEvent();
    const { unmount } = render(
      <SetIsEnumSection schema="public" tableName="user_profile" />,
    );

    expect(dialogMocks.setDirtySource).not.toHaveBeenCalledWith(
      'edit-gql-is-enum',
      true,
    );

    await user.click(screen.getByRole('switch'));

    expect(dialogMocks.setDirtySource).toHaveBeenCalledWith(
      'edit-gql-is-enum',
      true,
    );

    dialogMocks.setDirtySource.mockClear();
    unmount();

    expect(dialogMocks.setDirtySource).toHaveBeenCalledWith(
      'edit-gql-is-enum',
      false,
    );
  });
});

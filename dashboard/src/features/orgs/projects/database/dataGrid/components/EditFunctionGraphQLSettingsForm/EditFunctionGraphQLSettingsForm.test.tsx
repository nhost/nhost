import { vi } from 'vitest';
import { render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';
import EditFunctionGraphQLSettingsForm from './EditFunctionGraphQLSettingsForm';

const dialogMocks = vi.hoisted(() => ({
  setDirtySource: vi.fn(),
}));

const formMocks = vi.hoisted(() => ({
  useFunctionQuery: vi.fn(),
  useTrackFunctionWithTableToast: vi.fn(),
  useFunctionCustomizationQuery: vi.fn(),
  useSetFunctionCustomizationMutation: vi.fn(),
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
  '@/features/orgs/projects/database/dataGrid/hooks/useFunctionQuery',
  () => ({
    useFunctionQuery: formMocks.useFunctionQuery,
  }),
);

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useTrackFunctionWithTable',
  () => ({
    useTrackFunctionWithTableToast: formMocks.useTrackFunctionWithTableToast,
  }),
);

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useFunctionCustomizationQuery',
  () => ({
    useFunctionCustomizationQuery: formMocks.useFunctionCustomizationQuery,
  }),
);

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useSetFunctionCustomizationMutation',
  () => ({
    useSetFunctionCustomizationMutation:
      formMocks.useSetFunctionCustomizationMutation,
  }),
);

describe('EditFunctionGraphQLSettingsForm dirty-guard', () => {
  beforeEach(() => {
    formMocks.useFunctionQuery.mockReturnValue({
      data: {
        functionMetadata: {
          functionType: 'STABLE',
          returnTableName: 'user_profile',
          returnTableSchema: 'public',
        },
      },
    });
    formMocks.useTrackFunctionWithTableToast.mockReturnValue({
      isTracked: true,
      isReturnTableUntracked: false,
      isPending: false,
      trackFunctionWithToast: vi.fn(),
      toggleTrackingFunctionWithToast: vi.fn(),
    });
    formMocks.useFunctionCustomizationQuery.mockReturnValue({
      data: { configuration: {} },
      isLoading: false,
      refetch: vi.fn(),
    });
    formMocks.useSetFunctionCustomizationMutation.mockReturnValue({
      mutateAsync: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('reports dirty state through setDirtySource when a field is edited and on unmount', async () => {
    const user = new TestUserEvent();
    const { unmount } = render(
      <EditFunctionGraphQLSettingsForm
        schema="public"
        functionName="get_user"
      />,
    );

    expect(dialogMocks.setDirtySource).not.toHaveBeenCalledWith(
      'edit-fn-gql-settings',
      true,
    );

    const aggregateInput = screen.getByPlaceholderText(
      'get_user_aggregate (default)',
    );
    await user.type(aggregateInput, 'getUserAggregate');

    await waitFor(() => {
      expect(dialogMocks.setDirtySource).toHaveBeenCalledWith(
        'edit-fn-gql-settings',
        true,
      );
    });

    dialogMocks.setDirtySource.mockClear();
    unmount();

    expect(dialogMocks.setDirtySource).toHaveBeenCalledWith(
      'edit-fn-gql-settings',
      false,
    );
  });
});

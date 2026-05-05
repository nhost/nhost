import { act } from 'react';
import { vi } from 'vitest';
import { render } from '@/tests/testUtils';
import EditGraphQLSettingsForm from './EditGraphQLSettingsForm';

const dialogMocks = vi.hoisted(() => ({
  onDirtyStateChange: vi.fn(),
}));

const sectionState = vi.hoisted(() => ({
  columns: { current: undefined as ((dirty: boolean) => void) | undefined },
  rootFields: { current: undefined as ((dirty: boolean) => void) | undefined },
  isEnum: { current: undefined as ((dirty: boolean) => void) | undefined },
}));

const formMocks = vi.hoisted(() => ({
  useIsTrackedTable: vi.fn(),
  useGetMetadataResourceVersion: vi.fn(),
  useSetTableTrackingMutation: vi.fn(),
}));

vi.mock('@/components/common/DialogProvider', async () => {
  const actual = await vi.importActual<
    typeof import('@/components/common/DialogProvider')
  >('@/components/common/DialogProvider');
  return {
    ...actual,
    useDialog: () => ({
      onDirtyStateChange: dialogMocks.onDirtyStateChange,
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
  '@/features/orgs/projects/database/dataGrid/hooks/useIsTrackedTable',
  () => ({
    useIsTrackedTable: formMocks.useIsTrackedTable,
  }),
);

vi.mock(
  '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion',
  () => ({
    useGetMetadataResourceVersion: formMocks.useGetMetadataResourceVersion,
  }),
);

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useSetTableTrackingMutation',
  () => ({
    useSetTableTrackingMutation: formMocks.useSetTableTrackingMutation,
  }),
);

vi.mock('./sections/ColumnsNameCustomizationSection', () => ({
  ColumnsNameCustomizationSection: ({
    onDirtyChange,
  }: {
    onDirtyChange?: (dirty: boolean) => void;
  }) => {
    sectionState.columns.current = onDirtyChange;
    return <div data-testid="columns-section" />;
  },
}));

vi.mock('./sections/CustomGraphQLRootFieldsSection', () => ({
  CustomGraphQLRootFieldsSection: ({
    onDirtyChange,
  }: {
    onDirtyChange?: (dirty: boolean) => void;
  }) => {
    sectionState.rootFields.current = onDirtyChange;
    return <div data-testid="root-fields-section" />;
  },
}));

vi.mock('./sections/SetIsEnumSection', () => ({
  SetIsEnumSection: ({
    onDirtyChange,
  }: {
    onDirtyChange?: (dirty: boolean) => void;
  }) => {
    sectionState.isEnum.current = onDirtyChange;
    return <div data-testid="is-enum-section" />;
  },
}));

vi.mock('./sections/TrackUntrackSection', () => ({
  TrackUntrackSection: () => <div data-testid="track-untrack-section" />,
}));

describe('EditGraphQLSettingsForm dirty-state aggregation', () => {
  beforeEach(() => {
    formMocks.useIsTrackedTable.mockReturnValue({ data: true });
    formMocks.useGetMetadataResourceVersion.mockReturnValue({ data: 1 });
    formMocks.useSetTableTrackingMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    sectionState.columns.current = undefined;
    sectionState.rootFields.current = undefined;
    sectionState.isEnum.current = undefined;
  });

  it('forwards aggregated dirty=true to onDirtyStateChange when one section becomes dirty', () => {
    render(
      <EditGraphQLSettingsForm schema="public" tableName="user_profile" />,
    );

    expect(dialogMocks.onDirtyStateChange).toHaveBeenLastCalledWith(false);
    dialogMocks.onDirtyStateChange.mockClear();

    act(() => {
      sectionState.columns.current?.(true);
    });

    expect(dialogMocks.onDirtyStateChange).toHaveBeenCalledWith(true);
  });

  it('does not re-fire onDirtyStateChange when a second section also becomes dirty', () => {
    render(
      <EditGraphQLSettingsForm schema="public" tableName="user_profile" />,
    );

    act(() => {
      sectionState.columns.current?.(true);
    });
    dialogMocks.onDirtyStateChange.mockClear();

    act(() => {
      sectionState.rootFields.current?.(true);
    });

    expect(dialogMocks.onDirtyStateChange).not.toHaveBeenCalled();
  });

  it('keeps reporting dirty when one of two dirty sections becomes clean', () => {
    render(
      <EditGraphQLSettingsForm schema="public" tableName="user_profile" />,
    );

    act(() => {
      sectionState.columns.current?.(true);
      sectionState.rootFields.current?.(true);
    });
    dialogMocks.onDirtyStateChange.mockClear();

    act(() => {
      sectionState.columns.current?.(false);
    });

    expect(dialogMocks.onDirtyStateChange).not.toHaveBeenCalled();
  });

  it('reports dirty=false once all dirty sections become clean again', () => {
    render(
      <EditGraphQLSettingsForm schema="public" tableName="user_profile" />,
    );

    act(() => {
      sectionState.columns.current?.(true);
    });
    dialogMocks.onDirtyStateChange.mockClear();

    act(() => {
      sectionState.columns.current?.(false);
    });

    expect(dialogMocks.onDirtyStateChange).toHaveBeenCalledWith(false);
  });
});

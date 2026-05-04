import { vi } from 'vitest';
import { render, screen, TestUserEvent } from '@/tests/testUtils';
import SetIsEnumSection from './SetIsEnumSection';

const mocks = vi.hoisted(() => ({
  useTableIsEnumQuery: vi.fn(),
  useSetTableIsEnumMutation: vi.fn(),
  useGetMetadataResourceVersion: vi.fn(),
}));

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

  it('reports dirty state through onDirtyChange when the switch is toggled and on unmount', async () => {
    const user = new TestUserEvent();
    const onDirtyChange = vi.fn();
    const { unmount } = render(
      <SetIsEnumSection
        schema="public"
        tableName="user_profile"
        onDirtyChange={onDirtyChange}
      />,
    );

    expect(onDirtyChange).not.toHaveBeenCalledWith(true);

    await user.click(screen.getByRole('switch'));

    expect(onDirtyChange).toHaveBeenCalledWith(true);

    onDirtyChange.mockClear();
    unmount();

    expect(onDirtyChange).toHaveBeenCalledWith(false);
  });
});

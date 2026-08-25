import UserSelect from '@/features/orgs/projects/graphql/common/components/UserSelect/UserSelect';
import {
  act,
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';

const USER_ID = '00000000-0000-0000-0000-000000000001';

const mocks = vi.hoisted(() => ({
  fetchAppUsers: vi.fn(),
  userApplicationClient: {},
}));

vi.mock('@mui/material/utils', () => ({
  debounce: (callback: (...args: unknown[]) => unknown) => callback,
}));

vi.mock('@/features/orgs/hooks/useRemoteApplicationGQLClient', () => ({
  useRemoteApplicationGQLClient: () => mocks.userApplicationClient,
}));

vi.mock('@/generated/graphql', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/generated/graphql')>();

  return {
    ...actual,
    useRemoteAppGetUsersAndAuthRolesLazyQuery: () => [mocks.fetchAppUsers],
  };
});

mockPointerEvent();

const usersResponse = {
  data: {
    users: [
      {
        id: USER_ID,
        displayName: 'Tutorial User',
        roles: [{ role: 'user' }],
      },
    ],
    authRoles: [{ role: 'user' }],
  },
};

describe('UserSelect', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('keeps the selected user when the user list is refreshed', async () => {
    let resolveRefetch: (response: typeof usersResponse) => void = () => {};
    const refetchResponse = new Promise<typeof usersResponse>((resolve) => {
      resolveRefetch = resolve;
    });

    mocks.fetchAppUsers
      .mockResolvedValueOnce(usersResponse)
      .mockReturnValueOnce(refetchResponse);

    const onUserChange = vi.fn();
    const user = new TestUserEvent();

    render(<UserSelect onUserChange={onUserChange} />);

    await waitFor(() => {
      expect(mocks.fetchAppUsers).toHaveBeenCalledTimes(1);
      expect(onUserChange).toHaveBeenCalledWith('', [
        'admin',
        'public',
        'anonymous',
        'user',
      ]);
    });

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'Tutorial User' }));

    expect(onUserChange).toHaveBeenLastCalledWith(USER_ID, ['user']);

    await waitFor(() => {
      expect(mocks.fetchAppUsers).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      resolveRefetch(usersResponse);
      await refetchResponse;
    });

    expect(onUserChange).toHaveBeenLastCalledWith(USER_ID, ['user']);
  });
});

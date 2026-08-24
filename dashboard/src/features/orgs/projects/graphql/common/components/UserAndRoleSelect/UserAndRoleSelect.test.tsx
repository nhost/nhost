import UserAndRoleSelect from '@/features/orgs/projects/graphql/common/components/UserAndRoleSelect/UserAndRoleSelect';
import {
  act,
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';

const USER_ID = '00000000-0000-0000-0000-000000000001';
const SECOND_USER_ID = '00000000-0000-0000-0000-000000000002';

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
        roles: [{ role: 'user' }, { role: 'editor' }],
      },
    ],
    authRoles: [{ role: 'user' }, { role: 'editor' }],
  },
};

const multipleUsersResponse = {
  data: {
    users: [
      {
        id: USER_ID,
        displayName: 'First User',
        roles: [{ role: 'user' }],
      },
      {
        id: SECOND_USER_ID,
        displayName: 'Second User',
        roles: [{ role: 'me' }, { role: 'user' }],
      },
    ],
    authRoles: [{ role: 'user' }, { role: 'me' }],
  },
};

describe('UserAndRoleSelect', () => {
  beforeEach(() => {
    mocks.fetchAppUsers.mockReset();
  });

  it('keeps a non-admin role when the Admin user roles are refreshed by search', async () => {
    let resolveRefetch: (response: typeof usersResponse) => void = () => {};
    const refetchResponse = new Promise<typeof usersResponse>((resolve) => {
      resolveRefetch = resolve;
    });

    mocks.fetchAppUsers
      .mockResolvedValueOnce(usersResponse)
      .mockReturnValueOnce(refetchResponse);

    const onSelectionChange = vi.fn();
    const user = new TestUserEvent();

    render(<UserAndRoleSelect onSelectionChange={onSelectionChange} />);

    await waitFor(() => {
      expect(mocks.fetchAppUsers).toHaveBeenCalledTimes(1);
      expect(onSelectionChange).toHaveBeenLastCalledWith({
        userId: '',
        role: 'admin',
      });
    });

    const userTrigger = screen.getAllByRole('combobox')[0];
    const roleTrigger = screen.getByTestId('graphql-role-select');
    await user.click(roleTrigger);
    await user.click(screen.getByRole('option', { name: 'public' }));

    await user.click(userTrigger);
    await user.type(screen.getByPlaceholderText('Search...'), 't');

    await waitFor(() => {
      expect(mocks.fetchAppUsers).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      resolveRefetch(usersResponse);
      await refetchResponse;
    });

    expect(userTrigger).toHaveTextContent('Admin');
    expect(roleTrigger).toHaveTextContent('public');
    expect(onSelectionChange).toHaveBeenLastCalledWith({
      userId: '',
      role: 'public',
    });
  });

  it('resets the role to the first available role when the user changes', async () => {
    mocks.fetchAppUsers.mockResolvedValue(multipleUsersResponse);

    const onSelectionChange = vi.fn();
    const user = new TestUserEvent();

    render(<UserAndRoleSelect onSelectionChange={onSelectionChange} />);

    await waitFor(() => {
      expect(mocks.fetchAppUsers).toHaveBeenCalledTimes(1);
    });

    const userTrigger = screen.getAllByRole('combobox')[0];
    await user.click(userTrigger);
    await user.click(await screen.findByRole('option', { name: 'First User' }));

    expect(onSelectionChange).toHaveBeenLastCalledWith({
      userId: USER_ID,
      role: 'user',
    });

    await user.click(userTrigger);
    await user.click(screen.getByRole('option', { name: 'Second User' }));

    expect(screen.getByTestId('graphql-role-select')).toHaveTextContent('me');
    expect(onSelectionChange).toHaveBeenLastCalledWith({
      userId: SECOND_USER_ID,
      role: 'me',
    });
  });
});

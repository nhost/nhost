import { setupServer } from 'msw/node';
import LogicalModelPermissionForm from '@/features/orgs/projects/database/native-queries/components/LogicalModelPermissionForm/LogicalModelPermissionForm';
import { mockMatchMediaValue } from '@/tests/mocks';
import { getProjectQuery } from '@/tests/msw/mocks/graphql/getProjectQuery';
import permissionVariablesQuery from '@/tests/msw/mocks/graphql/permissionVariablesQuery';
import hasuraMetadataQuery from '@/tests/msw/mocks/rest/hasuraMetadataQuery';
import tableQuery from '@/tests/msw/mocks/rest/tableQuery';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import { render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';
import type {
  LogicalModelItem,
  LogicalModelSelectPermission,
} from '@/utils/hasura-api/generated/schemas';

const model: LogicalModelItem = {
  name: 'author',
  fields: [
    { name: 'id', type: { scalar: 'uuid', nullable: false } },
    { name: 'name', type: { scalar: 'text', nullable: true } },
    { name: 'profile', type: { logical_model: 'profile', nullable: true } },
  ],
};
const server = setupServer(
  tokenQuery,
  tableQuery,
  hasuraMetadataQuery,
  getProjectQuery,
  permissionVariablesQuery,
);
const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
  mutateAsync: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));
vi.mock(
  '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion',
  () => ({
    useGetMetadataResourceVersion: () => ({ data: 244 }),
  }),
);
vi.mock(
  '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelPermissionMutation',
  () => ({
    useLogicalModelPermissionMutation: () => ({
      mutateAsync: mocks.mutateAsync,
      isPending: false,
    }),
  }),
);

function renderForm(permission: LogicalModelSelectPermission) {
  render(
    // biome-ignore lint/a11y/useValidAriaRole: This component's role prop names a permission role, not an ARIA role.
    <LogicalModelPermissionForm
      source="default"
      model={{
        ...model,
        select_permissions: [{ role: 'user', permission }],
      }}
      role="user"
      availableRoles={['user']}
      onRoleChange={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
  return mocks.mutateAsync;
}

describe('LogicalModelPermissionForm validation', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_ENV = 'dev';
    process.env.NEXT_PUBLIC_NHOST_CONFIGSERVER_URL =
      'https://local.graphql.local.nhost.run/v1';
    server.listen({ onUnhandledRequest: 'error' });
    window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
  });

  beforeEach(() => {
    mocks.useRouter.mockReturnValue({
      basePath: '',
      pathname: '/orgs/xyz/projects/test-project',
      route: '/orgs/[orgSlug]/projects/[appSubdomain]',
      asPath: '/orgs/xyz/projects/test-project',
      isLocaleDomain: false,
      isReady: true,
      isPreview: false,
      query: {
        orgSlug: 'xyz',
        appSubdomain: 'test-project',
        dataSourceSlug: 'default',
      },
      push: vi.fn(),
      replace: vi.fn(),
      reload: vi.fn(),
      back: vi.fn(),
      prefetch: vi.fn(),
      beforePopState: vi.fn(),
      events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
      isFallback: false,
      forward: vi.fn(),
    });
    mocks.mutateAsync.mockReset().mockResolvedValue({ message: 'success' });
  });

  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('saves an unrestricted filter when switching off a stored custom check', async () => {
    const user = new TestUserEvent();
    const savePermission = renderForm({
      columns: ['id'],
      filter: { id: { _eq: 'X-Hasura-User-Id' } },
    });

    await user.click(screen.getByLabelText('Without any checks'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(savePermission).toHaveBeenCalledWith(
        expect.objectContaining({
          args: expect.objectContaining({
            permission: { columns: ['id'], filter: {} },
          }),
        }),
      ),
    );
  });

  it('serializes the tree when selecting a custom check', async () => {
    const user = new TestUserEvent();
    const savePermission = renderForm({ columns: ['id'], filter: {} });
    const filter = { id: { _eq: 'X-Hasura-User-Id' } };

    await user.click(screen.getByLabelText('With custom check'));
    await user.click(screen.getByRole('button', { name: 'JSON' }));
    await user.clear(screen.getByRole('textbox'));
    await user.paste(JSON.stringify(filter));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(savePermission).toHaveBeenCalledWith(
        expect.objectContaining({
          args: expect.objectContaining({
            permission: { columns: ['id'], filter },
          }),
        }),
      ),
    );
  });

  it.each([
    {
      label: '_is_null',
      filter: { id: { _is_null: true } },
    },
    {
      label: 'compound _or alternative',
      filter: {
        _or: [
          {
            id: { _eq: 'X-Hasura-User-Id' },
            name: { _eq: 'private' },
          },
          { name: { _eq: 'public' } },
        ],
      },
    },
    {
      label: 'multi-operator _or alternative',
      filter: {
        _or: [
          { name: { _ilike: '%a%', _neq: 'b' } },
          { id: { _eq: 'X-Hasura-User-Id' } },
        ],
      },
    },
  ])(
    'opens a stored $label filter in Visual and round-trips it',
    async ({ filter }) => {
      const user = new TestUserEvent();
      const savePermission = renderForm({ columns: ['id'], filter });

      expect(screen.getByRole('button', { name: 'Visual' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();

      await user.click(screen.getByRole('checkbox', { name: 'name' }));
      await user.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() =>
        expect(savePermission).toHaveBeenCalledWith(
          expect.objectContaining({
            source: 'default',
            resourceVersion: 244,
            args: expect.objectContaining({
              name: model.name,
              role: 'user',
              permission: { columns: ['id', 'name'], filter },
            }),
          }),
        ),
      );
    },
  );

  it('opens an outer column comparison in Visual and saves it', async () => {
    const user = new TestUserEvent();
    const filter = { id: { _ceq: ['id'] } };
    const savePermission = renderForm({ columns: ['id'], filter });

    const visual = screen.getByRole('button', { name: 'Visual' });
    expect(visual).toBeEnabled();
    expect(visual).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('combobox', {
        name: 'Logical model comparison field',
      }),
    ).toHaveTextContent('id');

    await user.click(screen.getByRole('checkbox', { name: 'name' }));
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeEnabled();
    await user.click(save);
    await waitFor(() =>
      expect(savePermission).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'default',
          resourceVersion: 244,
          args: expect.objectContaining({
            name: model.name,
            role: 'user',
            permission: { columns: ['id', 'name'], filter },
          }),
        }),
      ),
    );
  });
});

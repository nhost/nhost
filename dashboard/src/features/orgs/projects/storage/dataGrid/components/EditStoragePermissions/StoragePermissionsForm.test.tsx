import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import { getProjectQuery } from '@/tests/msw/mocks/graphql/getProjectQuery';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import permissionVariablesQuery from '@/tests/msw/mocks/graphql/permissionVariablesQuery';
import { hasuraColumnMetadataQuery } from '@/tests/msw/mocks/rest/hasuraMetadataQuery';
import tableQuery from '@/tests/msw/mocks/rest/tableQuery';
import {
  queryClient,
  render,
  screen,
  waitFor,
  within,
} from '@/tests/testUtils';

import StoragePermissionsForm from './StoragePermissionsForm';

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

function getRouter() {
  return {
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
  };
}

const rolesQuery = nhostGraphQLLink.query('getRemoteAppRoles', () =>
  HttpResponse.json({
    data: { authRoles: [{ role: 'user' }, { role: 'editor' }] },
  }),
);

function createMetadataHandler(storageFilesTable?: Record<string, unknown>) {
  return http.post('https://local.hasura.local.nhost.run/v1/metadata', () => {
    const tables = storageFilesTable ? [storageFilesTable] : [];

    return HttpResponse.json({
      resource_version: 1,
      metadata: {
        version: 3,
        sources: [
          {
            name: 'default',
            kind: 'postgres',
            tables,
            configuration: {
              connection_info: {
                database_url: {
                  from_env: 'HASURA_GRAPHQL_DATABASE_URL',
                },
              },
            },
          },
        ],
      },
    });
  });
}

const STORAGE_FILES_TABLE_BASE = {
  table: { name: 'files', schema: 'storage' },
  configuration: {},
};

const getBucketsQuery = nhostGraphQLLink.query('getBuckets', () =>
  HttpResponse.json({ data: { buckets: [] } }),
);

const editorHandlers = [
  tableQuery,
  hasuraColumnMetadataQuery,
  getProjectQuery,
  permissionVariablesQuery,
  getBucketsQuery,
];

const server = setupServer(rolesQuery, createMetadataHandler());

describe('StoragePermissionsForm', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_ENV = 'dev';
    process.env.NEXT_PUBLIC_NHOST_CONFIGSERVER_URL =
      'https://local.graphql.local.nhost.run/v1';
    server.listen();
  });

  beforeEach(() => {
    queryClient.clear();
    mocks.useRouter.mockReturnValue(getRouter());
    server.restoreHandlers();
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  it('builds role list as ["public", ...authRoles]', async () => {
    server.use(rolesQuery, createMetadataHandler());
    render(<StoragePermissionsForm />);

    await waitFor(() => {
      expect(screen.getByText('public')).toBeInTheDocument();
    });
    expect(screen.getByText('user')).toBeInTheDocument();
    expect(screen.getByText('editor')).toBeInTheDocument();
  });

  it('renders all 4 storage action labels (Upload, Download, Replace, Delete)', async () => {
    server.use(rolesQuery, createMetadataHandler());
    render(<StoragePermissionsForm />);

    await waitFor(() => {
      expect(screen.getByText('Upload')).toBeInTheDocument();
    });
    expect(screen.getByText('Download')).toBeInTheDocument();
    expect(screen.getByText('Replace')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('access level is "none" when no permission exists for role+action', async () => {
    // No storage.files table in metadata → all permissions are "none"
    server.use(rolesQuery, createMetadataHandler());
    render(<StoragePermissionsForm />);

    await waitFor(() => {
      expect(screen.getByText('public')).toBeInTheDocument();
    });

    for (const role of ['public', 'user', 'editor']) {
      const row = screen.getByText(role).closest('tr')!;
      const buttons = within(row).getAllByRole('button');
      for (const button of buttons) {
        expect(
          within(button).getByLabelText('No permission'),
        ).toBeInTheDocument();
      }
    }
  });

  it('access level is "full" when permission exists without check/filter', async () => {
    server.use(
      rolesQuery,
      createMetadataHandler({
        ...STORAGE_FILES_TABLE_BASE,
        select_permissions: [
          {
            role: 'user',
            permission: {
              columns: [
                'id',
                'name',
                'size',
                'bucket_id',
                'etag',
                'created_at',
                'updated_at',
                'is_uploaded',
                'mime_type',
                'uploaded_by_user_id',
                'metadata',
              ],
              filter: {},
            },
          },
        ],
      }),
    );
    render(<StoragePermissionsForm />);

    await waitFor(() => {
      expect(screen.getByText('user')).toBeInTheDocument();
    });

    // actions order: [Upload(0), Download(1), Replace(2), Delete(3)]
    const userRow = screen.getByText('user').closest('tr')!;
    const buttons = within(userRow).getAllByRole('button');
    expect(
      within(buttons[1]).getByLabelText('Full permission'),
    ).toBeInTheDocument();
    expect(
      within(buttons[0]).getByLabelText('No permission'),
    ).toBeInTheDocument();
    expect(
      within(buttons[2]).getByLabelText('No permission'),
    ).toBeInTheDocument();
    expect(
      within(buttons[3]).getByLabelText('No permission'),
    ).toBeInTheDocument();
  });

  it('shows "none" for Download when select permission only has the id column (upload grant)', async () => {
    server.use(
      rolesQuery,
      createMetadataHandler({
        ...STORAGE_FILES_TABLE_BASE,
        select_permissions: [
          {
            role: 'user',
            permission: { columns: ['id'], filter: {} },
          },
        ],
      }),
    );
    render(<StoragePermissionsForm />);

    await waitFor(() => {
      expect(screen.getByText('user')).toBeInTheDocument();
    });

    const userRow = screen.getByText('user').closest('tr')!;
    const buttons = within(userRow).getAllByRole('button');
    // actions order: [Upload(0), Download(1), Replace(2), Delete(3)]
    expect(
      within(buttons[1]).getByLabelText('No permission'),
    ).toBeInTheDocument();
  });

  it('access level is "partial" when permission has check or filter', async () => {
    server.use(
      rolesQuery,
      createMetadataHandler({
        ...STORAGE_FILES_TABLE_BASE,
        insert_permissions: [
          {
            role: 'user',
            permission: {
              columns: ['id', 'bucket_id', 'mime_type', 'name', 'size'],
              check: { bucket_id: { _eq: 'default' } },
            },
          },
        ],
      }),
    );
    render(<StoragePermissionsForm />);

    await waitFor(() => {
      expect(screen.getByText('user')).toBeInTheDocument();
    });

    // actions order: [Upload(0), Download(1), Replace(2), Delete(3)]
    const userRow = screen.getByText('user').closest('tr')!;
    const buttons = within(userRow).getAllByRole('button');
    expect(
      within(buttons[0]).getByLabelText('Partial permission'),
    ).toBeInTheDocument();
  });

  it('selecting a role+action navigates to the editor form', async () => {
    server.use(rolesQuery, createMetadataHandler(), ...editorHandlers);
    render(<StoragePermissionsForm />);

    await waitFor(() => {
      expect(screen.getByText('public')).toBeInTheDocument();
    });

    // The grid header is visible
    expect(screen.getByText('Roles & Actions overview')).toBeInTheDocument();

    const user = userEvent.setup();
    // Index 0 is the legend icon; grid cells start at index 1.
    // Grid order per role: [Upload, Download, Replace, Delete]
    // Roles order: [public, user, editor] → index 1 = public+Upload
    const noPermIcons = screen.getAllByLabelText('No permission');
    await user.click(noPermIcons[1].closest('button')!);

    await waitFor(() => {
      expect(
        screen.queryByText('Roles & Actions overview'),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole('combobox', { name: /action/i })).toHaveTextContent(
      'Upload',
    );
    expect(screen.getByText('File upload permissions')).toBeInTheDocument();
  });

  it('maps DB actions to storage actions on selection (insert→Upload, select→Download)', async () => {
    server.use(rolesQuery, createMetadataHandler(), ...editorHandlers);
    render(<StoragePermissionsForm />);

    await waitFor(() => {
      expect(screen.getByText('public')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    // Index 0 is legend. Grid: [Upload, Download, Replace, Delete] per role.
    // Index 1 = public+Upload, index 2 = public+Download
    const noPermIcons = screen.getAllByLabelText('No permission');
    await user.click(noPermIcons[2].closest('button')!);

    await waitFor(() => {
      expect(
        screen.queryByText('Roles & Actions overview'),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole('combobox', { name: /action/i })).toHaveTextContent(
      'Download',
    );
  });
});

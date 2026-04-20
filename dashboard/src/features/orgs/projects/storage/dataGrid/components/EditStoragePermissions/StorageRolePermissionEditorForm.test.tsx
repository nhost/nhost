import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { type Mock, vi } from 'vitest';
import { getProjectQuery } from '@/tests/msw/mocks/graphql/getProjectQuery';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import permissionVariablesQuery from '@/tests/msw/mocks/graphql/permissionVariablesQuery';
import { hasuraColumnMetadataQuery } from '@/tests/msw/mocks/rest/hasuraMetadataQuery';
import tableQuery from '@/tests/msw/mocks/rest/tableQuery';
import { queryClient, render, screen, waitFor } from '@/tests/testUtils';
import type { StorageRolePermissionEditorFormProps } from './StorageRolePermissionEditorForm';
import StorageRolePermissionEditorForm from './StorageRolePermissionEditorForm';

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

const getBucketsQuery = nhostGraphQLLink.query('getBuckets', () =>
  HttpResponse.json({ data: { buckets: [] } }),
);

const server = setupServer(
  tableQuery,
  hasuraColumnMetadataQuery,
  getProjectQuery,
  permissionVariablesQuery,
  getBucketsQuery,
);

function renderEditor(
  props: Partial<StorageRolePermissionEditorFormProps> = {},
) {
  const defaultProps: StorageRolePermissionEditorFormProps = {
    role: 'user',
    resourceVersion: 1,
    storageAction: 'upload',
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    ...props,
  };

  return render(<StorageRolePermissionEditorForm {...defaultProps} />);
}

describe('StorageRolePermissionEditorForm', () => {
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

  describe('form initialization', () => {
    it('defaults to "Without any checks" when no permission exists', () => {
      renderEditor({ storageAction: 'download' });

      expect(screen.getByLabelText('Without any checks')).toBeChecked();
      expect(screen.getByLabelText('With custom check')).not.toBeChecked();
    });

    it('selects "With custom check" when insert permission has check', () => {
      renderEditor({
        storageAction: 'upload',
        permission: {
          columns: ['id'],
          check: { bucket_id: { _eq: 'default' } },
        },
      });

      expect(screen.getByLabelText('With custom check')).toBeChecked();
    });

    it('selects "With custom check" when select permission has filter', () => {
      renderEditor({
        storageAction: 'download',
        permission: {
          columns: ['id'],
          filter: { bucket_id: { _eq: 'default' } },
        },
      });

      expect(screen.getByLabelText('With custom check')).toBeChecked();
    });

    it('defaults to "Without any checks" when permission has no check or filter', () => {
      renderEditor({
        storageAction: 'download',
        permission: { columns: ['id'], filter: {} },
      });

      expect(screen.getByLabelText('Without any checks')).toBeChecked();
    });

    it('initializes prefillUploadedByUserId switch from permission.set', () => {
      renderEditor({
        storageAction: 'upload',
        permission: {
          columns: ['id'],
          check: {},
          set: { uploaded_by_user_id: 'X-Hasura-User-Id' },
        },
      });

      expect(screen.getByRole('switch')).toBeChecked();
    });

    it('prefillUploadedByUserId switch is off when set is absent', () => {
      renderEditor({
        storageAction: 'upload',
        permission: { columns: ['id'], check: {} },
      });

      expect(screen.getByRole('switch')).not.toBeChecked();
    });
  });

  describe('UI rendering', () => {
    it('displays role name and action label in header', () => {
      renderEditor({ role: 'editor', storageAction: 'download' });

      expect(
        screen.getByText(
          (_, el) =>
            el?.tagName === 'SPAN' && el.textContent === 'Role: editor',
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          (_, el) =>
            el?.tagName === 'SPAN' && el.textContent === 'Action: Download',
        ),
      ).toBeInTheDocument();
    });

    it('shows upload preset section for upload action', () => {
      renderEditor({ storageAction: 'upload' });

      expect(screen.getByText('Uploader identity')).toBeInTheDocument();
    });

    it('shows upload preset section for replace action', () => {
      renderEditor({ storageAction: 'replace' });

      expect(screen.getByText('Uploader identity')).toBeInTheDocument();
    });

    it('does not show upload preset section for download action', () => {
      renderEditor({ storageAction: 'download' });

      expect(screen.queryByText('Uploader identity')).not.toBeInTheDocument();
    });

    it('does not show upload preset section for delete action', () => {
      renderEditor({ storageAction: 'delete' });

      expect(screen.queryByText('Uploader identity')).not.toBeInTheDocument();
    });

    it('shows Delete Permissions button when permission has all required columns', () => {
      renderEditor({
        storageAction: 'upload',
        permission: {
          columns: ['id', 'bucket_id', 'mime_type', 'name', 'size'],
          check: {},
        },
      });

      expect(
        screen.getByRole('button', { name: 'Delete Permissions' }),
      ).toBeInTheDocument();
    });

    it('shows Delete Permissions button when download permission has all required columns', () => {
      renderEditor({
        storageAction: 'download',
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
      });

      expect(
        screen.getByRole('button', { name: 'Delete Permissions' }),
      ).toBeInTheDocument();
    });

    it('shows Delete Permissions button when replace permission has all required columns', () => {
      renderEditor({
        storageAction: 'replace',
        permission: {
          columns: [
            'bucket_id',
            'etag',
            'is_uploaded',
            'metadata',
            'mime_type',
            'name',
            'size',
          ],
          filter: {},
        },
      });

      expect(
        screen.getByRole('button', { name: 'Delete Permissions' }),
      ).toBeInTheDocument();
    });

    it('shows Delete Permissions button for delete action when permission exists', () => {
      renderEditor({
        storageAction: 'delete',
        permission: { columns: [], filter: {} },
      });

      expect(
        screen.getByRole('button', { name: 'Delete Permissions' }),
      ).toBeInTheDocument();
    });

    it('does not show Delete Permissions button when no existing permission', () => {
      renderEditor();

      expect(
        screen.queryByRole('button', { name: 'Delete Permissions' }),
      ).not.toBeInTheDocument();
    });

    it('does not show Delete Permissions button when upload permission is missing required columns', () => {
      renderEditor({
        storageAction: 'upload',
        permission: { columns: ['id'], check: {} },
      });

      expect(
        screen.queryByRole('button', { name: 'Delete Permissions' }),
      ).not.toBeInTheDocument();
    });

    it('does not show Delete Permissions button when download permission only has the id column (upload grant)', () => {
      renderEditor({
        storageAction: 'download',
        permission: { columns: ['id'], filter: {} },
      });

      expect(
        screen.queryByRole('button', { name: 'Delete Permissions' }),
      ).not.toBeInTheDocument();
    });
  });

  describe('submit flow', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
    });

    function createMigrationHandler(spy: Mock) {
      return http.post(
        'https://local.hasura.local.nhost.run',
        async ({ request }) => {
          const body = await request.json();
          spy(body);
          return HttpResponse.json({ message: 'success' });
        },
      );
    }

    function createMetadataHandler(spy: Mock) {
      return http.post(
        'https://test-project.hasura.us-east-1.nhost.run/v1/metadata',
        async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;

          if (body.type !== 'bulk') {
            return undefined;
          }

          spy(body);
          return HttpResponse.json([{ affected_rows: 1 }]);
        },
      );
    }

    describe('local mode (migration API)', () => {
      it('submits with mode "insert" when no existing permission', async () => {
        const spy = vi.fn();
        server.use(createMigrationHandler(spy));

        renderEditor({ storageAction: 'upload' });

        const user = userEvent.setup();
        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => {
          expect(spy).toHaveBeenCalledTimes(1);
        });

        const body = spy.mock.calls[0][0];
        expect(body.up).toHaveLength(1);
        expect(body.up[0].type).toBe('pg_create_insert_permission');
      });

      it('submits with mode "update" when permission exists', async () => {
        const spy = vi.fn();
        server.use(createMigrationHandler(spy));

        renderEditor({
          storageAction: 'download',
          permission: { columns: ['id'], filter: {} },
        });

        const user = userEvent.setup();
        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => {
          expect(spy).toHaveBeenCalledTimes(1);
        });

        const body = spy.mock.calls[0][0];
        expect(body.up).toHaveLength(2);
        expect(body.up[0].type).toBe('pg_drop_select_permission');
        expect(body.up[1].type).toBe('pg_create_select_permission');
      });

      it('sends filter into "check" for upload (insert) action', async () => {
        const spy = vi.fn();
        server.use(createMigrationHandler(spy));

        renderEditor({ storageAction: 'upload' });

        const user = userEvent.setup();
        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => {
          expect(spy).toHaveBeenCalledTimes(1);
        });

        const permission = spy.mock.calls[0][0].up[0].args.permission;
        expect(permission.check).toBeDefined();
        expect(permission.filter).toBeUndefined();
      });

      it('sends filter into "filter" for download (select) action', async () => {
        const spy = vi.fn();
        server.use(createMigrationHandler(spy));

        renderEditor({ storageAction: 'download' });

        const user = userEvent.setup();
        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => {
          expect(spy).toHaveBeenCalledTimes(1);
        });

        const permission = spy.mock.calls[0][0].up[0].args.permission;
        expect(permission.filter).toBeDefined();
        expect(permission.check).toBeUndefined();
      });

      it('sets uploaded_by_user_id when prefillUploadedByUserId is enabled', async () => {
        const spy = vi.fn();
        server.use(createMigrationHandler(spy));

        renderEditor({ storageAction: 'upload' });

        const user = userEvent.setup();
        await user.click(screen.getByRole('switch'));
        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => {
          expect(spy).toHaveBeenCalledTimes(1);
        });

        const permission = spy.mock.calls[0][0].up[0].args.permission;
        expect(permission.set).toEqual({
          uploaded_by_user_id: 'X-Hasura-User-Id',
        });
      });

      it('calls onSubmit callback on success', async () => {
        const spy = vi.fn();
        const onSubmit = vi.fn();
        server.use(createMigrationHandler(spy));

        renderEditor({ storageAction: 'upload', onSubmit });

        const user = userEvent.setup();
        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => {
          expect(onSubmit).toHaveBeenCalledTimes(1);
        });
      });
    });

    it('sends correct columns for download action', async () => {
      const spy = vi.fn();
      server.use(createMigrationHandler(spy));

      renderEditor({ storageAction: 'download' });

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(spy).toHaveBeenCalledTimes(1);
      });

      const permission = spy.mock.calls[0][0].up[0].args.permission;
      expect(permission.columns).toEqual([
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
      ]);
    });

    it('sends correct columns for upload action', async () => {
      const spy = vi.fn();
      server.use(createMigrationHandler(spy));

      renderEditor({ storageAction: 'upload' });

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(spy).toHaveBeenCalledTimes(1);
      });

      const permission = spy.mock.calls[0][0].up[0].args.permission;
      expect(permission.columns).toEqual([
        'id',
        'bucket_id',
        'mime_type',
        'name',
        'size',
      ]);
    });

    describe('platform mode (metadata API)', () => {
      beforeEach(() => {
        process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
      });

      afterEach(() => {
        delete process.env.NEXT_PUBLIC_NHOST_PLATFORM;
      });

      it('submits with mode "insert" when no existing permission', async () => {
        const spy = vi.fn();
        server.use(createMetadataHandler(spy));

        renderEditor({ storageAction: 'upload' });

        const user = userEvent.setup();
        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => {
          expect(spy).toHaveBeenCalledTimes(1);
        });

        const body = spy.mock.calls[0][0];
        expect(body.args).toHaveLength(1);
        expect(body.args[0].type).toBe('pg_create_insert_permission');
      });

      it('submits with mode "update" when permission exists', async () => {
        const spy = vi.fn();
        server.use(createMetadataHandler(spy));

        renderEditor({
          storageAction: 'download',
          permission: { columns: ['id'], filter: {} },
        });

        const user = userEvent.setup();
        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => {
          expect(spy).toHaveBeenCalledTimes(1);
        });

        const body = spy.mock.calls[0][0];
        expect(body.args).toHaveLength(2);
        expect(body.args[0].type).toBe('pg_drop_select_permission');
        expect(body.args[1].type).toBe('pg_create_select_permission');
      });
    });
  });

  describe('delete flow', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
    });

    function createMigrationHandler(spy: Mock) {
      return http.post(
        'https://local.hasura.local.nhost.run',
        async ({ request }) => {
          const body = await request.json();
          spy(body);
          return HttpResponse.json({ message: 'success' });
        },
      );
    }

    it('opens confirmation dialog with role and action names', async () => {
      renderEditor({
        role: 'editor',
        storageAction: 'download',
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
      });

      const user = userEvent.setup();
      await user.click(
        screen.getByRole('button', { name: 'Delete Permissions' }),
      );

      await waitFor(() => {
        expect(screen.getByText('Delete permissions')).toBeInTheDocument();
      });

      expect(
        screen.getByText((_: string, el: Element | null) =>
          Boolean(
            el?.textContent?.includes('Download') &&
              el?.textContent?.includes('editor') &&
              el?.tagName === 'SPAN',
          ),
        ),
      ).toBeInTheDocument();
    });

    it('calls managePermission with mode "delete" on confirm', async () => {
      const spy = vi.fn();
      const onSubmit = vi.fn();
      server.use(createMigrationHandler(spy));

      renderEditor({
        storageAction: 'download',
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
        onSubmit,
      });

      const user = userEvent.setup();
      await user.click(
        screen.getByRole('button', { name: 'Delete Permissions' }),
      );

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: 'Delete' }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Delete' }));

      await waitFor(() => {
        expect(spy).toHaveBeenCalledTimes(1);
      });

      const body = spy.mock.calls[0][0];
      expect(body.up).toHaveLength(1);
      expect(body.up[0].type).toBe('pg_drop_select_permission');
    });

    it('calls onSubmit callback after successful delete', async () => {
      const spy = vi.fn();
      const onSubmit = vi.fn();
      server.use(createMigrationHandler(spy));

      renderEditor({
        storageAction: 'upload',
        permission: {
          columns: ['id', 'bucket_id', 'mime_type', 'name', 'size'],
          check: {},
        },
        onSubmit,
      });

      const user = userEvent.setup();
      await user.click(
        screen.getByRole('button', { name: 'Delete Permissions' }),
      );

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: 'Delete' }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Delete' }));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('dirty state', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
    });

    it('calls onCancel directly when form is not dirty', async () => {
      const onCancel = vi.fn();
      renderEditor({ onCancel });

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('opens dirty confirmation when cancelling with unsaved changes', async () => {
      const onCancel = vi.fn();
      renderEditor({ storageAction: 'upload', onCancel });

      const user = userEvent.setup();

      // Make the form dirty by toggling the switch
      await user.click(screen.getByRole('switch'));

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
      });

      // onCancel should not have been called yet
      expect(onCancel).not.toHaveBeenCalled();
    });

    it('calls onCancel after confirming discard in dirty dialog', async () => {
      const onCancel = vi.fn();
      renderEditor({ storageAction: 'upload', onCancel });

      const user = userEvent.setup();

      await user.click(screen.getByRole('switch'));
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Discard' }));

      await waitFor(() => {
        expect(onCancel).toHaveBeenCalledTimes(1);
      });
    });
  });
});

import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { toast } from 'react-hot-toast';
import { DatabaseExtensions } from '@/features/orgs/projects/database/extensions/components/DatabaseExtensions';
import { DEFAULT_PRELOADED_LIBRARIES } from '@/features/orgs/projects/database/extensions/constants';
import type { PostgresExtension } from '@/features/orgs/projects/database/extensions/hooks/usePostgresExtensionsQuery';
import {
  buildExtensionMigration,
  getInstallExtensionSQL,
  getUninstallExtensionSQL,
} from '@/features/orgs/projects/database/extensions/hooks/useSetExtensionInstalledMutation';
import { mockMatchMediaValue } from '@/tests/mocks';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import {
  act,
  mockScrollIntoViewAndPointerCapture,
  queryClient,
  render,
  screen,
  TestUserEvent,
  waitFor,
  within,
} from '@/tests/testUtils';
import { ApplicationStatus } from '@/types/application';

const HASURA_URL = 'https://local.hasura.local.nhost.run';
const MIGRATIONS_URL = `${HASURA_URL}/apis/migrate`;

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
  useIsPlatform: vi.fn(),
  useProject: vi.fn(),
  useAppState: vi.fn(),
}));

vi.mock('next/router', () => ({ useRouter: mocks.useRouter }));

vi.mock('@/features/orgs/projects/common/hooks/useIsPlatform', () => ({
  useIsPlatform: mocks.useIsPlatform,
}));

vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: mocks.useProject,
}));

vi.mock('@/features/orgs/projects/common/hooks/useAppState', () => ({
  useAppState: mocks.useAppState,
}));

// Local config requests go through the test Apollo client.
vi.mock('@/features/orgs/projects/hooks/useLocalMimirClient', () => ({
  useLocalMimirClient: () => undefined,
}));

vi.mock('@uiw/react-codemirror', () => ({
  default: ({
    value,
    onChange,
    'aria-label': ariaLabel,
  }: {
    value: string;
    onChange?: (value: string) => void;
    'aria-label'?: string;
  }) => (
    <textarea
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

const catalog: PostgresExtension[] = [
  {
    name: 'citext',
    default_version: '1.6',
    installed_version: '1.6',
    comment: 'data type for case-insensitive character strings',
    requires: [],
  },
  {
    name: 'cube',
    default_version: '1.5',
    installed_version: null,
    comment: 'data type for multidimensional cubes',
    requires: [],
  },
  {
    name: 'earthdistance',
    default_version: '1.2',
    installed_version: null,
    comment: 'calculate great-circle distances on the surface of the Earth',
    requires: ['cube'],
  },
  {
    name: 'hstore',
    default_version: '1.8',
    installed_version: null,
    comment: 'data type for storing sets of key/value pairs',
    requires: [],
  },
  {
    name: 'pg_cron',
    default_version: '1.6',
    installed_version: null,
    comment: 'job scheduler for PostgreSQL',
    requires: [],
  },
  {
    name: 'pg_durable',
    default_version: '0.2.8',
    installed_version: '0.2.8',
    comment: 'SQL-native durable orchestrations for PostgreSQL',
    requires: [],
  },
  {
    name: 'pg_ivm',
    default_version: '1.15',
    installed_version: null,
    comment: 'incremental view maintenance on PostgreSQL',
    requires: [],
  },
  {
    name: 'postgis',
    default_version: '3.6.1',
    installed_version: '3.6.1',
    comment: 'PostGIS geometry and geography spatial types and functions',
    requires: [],
  },
  {
    name: 'uuid-ossp',
    default_version: '1.1',
    installed_version: null,
    comment: 'generate universally unique identifiers',
    requires: [],
  },
  {
    name: 'vector',
    default_version: '0.8.1',
    installed_version: null,
    comment: 'vector data type and ivfflat and hnsw access methods',
    requires: [],
  },
];

let catalogRequests = 0;
let writeRequests: Array<{ url: string; body: unknown }> = [];
let preloadedLibraries: string[] = [];
// `null` mirrors a project that never set `sharedPreloadLibraries`.
let configuredLibraries: string[] | null = null;
let configUpdates: unknown[] = [];

function postgresError(status_code: string, message: string) {
  return {
    code: 'postgres-error',
    error: 'query execution failed',
    path: '$.args[0].args',
    internal: { error: { status_code, message, exec_status: 'FatalError' } },
  };
}

// The migrations API wraps the Hasura error in a JSON `message` string.
function migrationError(status_code: string, message: string) {
  return HttpResponse.json(
    {
      code: 'unexpected',
      message: JSON.stringify(postgresError(status_code, message)),
    },
    { status: 400 },
  );
}

const server = setupServer(
  http.post(`${HASURA_URL}/v2/query`, async ({ request }) => {
    const body = (await request.json()) as {
      args: Array<{ args: { read_only: boolean; sql: string } }>;
    };
    const { read_only: readOnly, sql } = body.args[0].args;

    if (readOnly && sql.includes('shared_preload_libraries')) {
      return HttpResponse.json([
        {
          result_type: 'TuplesOk',
          result: [['current_setting'], [preloadedLibraries.join(',')]],
        },
      ]);
    }

    if (readOnly) {
      catalogRequests += 1;

      return HttpResponse.json([
        {
          result_type: 'TuplesOk',
          result: [['data'], ...catalog.map((row) => [JSON.stringify(row)])],
        },
      ]);
    }

    writeRequests.push({ url: request.url, body });

    return HttpResponse.json([{ result_type: 'CommandOk', result: null }]);
  }),
  http.post(MIGRATIONS_URL, async ({ request }) => {
    writeRequests.push({ url: request.url, body: await request.json() });

    return HttpResponse.json({ name: 'migration', version: 1 });
  }),
  nhostGraphQLLink.query('GetConfiguredPreloadLibraries', () =>
    HttpResponse.json({
      data: {
        config: {
          __typename: 'ConfigConfig',
          id: 'ConfigConfig',
          postgres: {
            __typename: 'ConfigPostgres',
            settings: configuredLibraries && {
              __typename: 'ConfigPostgresSettings',
              sharedPreloadLibraries: configuredLibraries,
            },
          },
        },
      },
    }),
  ),
  nhostGraphQLLink.mutation('UpdateConfig', ({ variables }) => {
    configUpdates.push(variables.config);
    configuredLibraries =
      variables.config.postgres.settings.sharedPreloadLibraries;

    return HttpResponse.json({
      data: {
        updateConfig: { __typename: 'ConfigConfig', id: 'ConfigConfig' },
      },
    });
  }),
);

beforeAll(() => {
  mockScrollIntoViewAndPointerCapture();
  server.listen({ onUnhandledRequest: 'error' });
});
beforeEach(() => {
  mocks.useRouter.mockReturnValue({
    query: {
      orgSlug: 'local',
      appSubdomain: 'local',
      dataSourceSlug: 'default',
    },
  });
  mocks.useIsPlatform.mockReturnValue(false);
  mocks.useAppState.mockReturnValue({ state: ApplicationStatus.Live });
  mocks.useProject.mockReturnValue({
    project: {
      id: 'project-id',
      subdomain: 'local',
      region: { name: 'local', domain: 'local.nhost.run' },
      config: { hasura: { adminSecret: 'nhost-admin-secret' } },
    },
  });
  catalogRequests = 0;
  writeRequests = [];
  preloadedLibraries = [...DEFAULT_PRELOADED_LIBRARIES];
  configuredLibraries = null;
  configUpdates = [];
});
afterEach(() => {
  server.resetHandlers();
  queryClient.clear();
  toast.remove();
});
afterAll(() => server.close());

async function renderPage() {
  render(<DatabaseExtensions />);

  return screen.findByRole('region', { name: 'All extensions' });
}

function getRow(region: HTMLElement, name: string) {
  return within(region).getByTestId(`extension-row-${name}`);
}

async function openInstallDialog(
  user: TestUserEvent,
  region: HTMLElement,
  name: string,
) {
  await user.click(within(region).getByTestId(`install-extension-${name}`));

  return screen.findByRole('dialog');
}

function getInstallButton(dialog: HTMLElement) {
  return within(dialog).getByTestId('confirm-install-extension');
}

async function waitUntilInstallable(dialog: HTMLElement) {
  await waitFor(() => expect(getInstallButton(dialog)).toBeEnabled());
}

function getPreloadStep(dialog: HTMLElement) {
  return within(dialog).getAllByRole('listitem')[0];
}

describe('DatabaseExtensions', () => {
  it('lists popular cards above the table with every extension', async () => {
    const all = await renderPage();
    const popular = screen.getByRole('region', { name: 'Popular extensions' });

    expect(
      within(popular)
        .getAllByTestId(/^extension-card-/)
        .map((card) => card.getAttribute('data-testid')),
    ).toEqual([
      'extension-card-vector',
      'extension-card-postgis',
      'extension-card-pg_cron',
      'extension-card-uuid-ossp',
    ]);
    expect(within(all).getAllByTestId(/^extension-row-/)).toHaveLength(
      catalog.length,
    );
    expect(
      screen.getByText(
        'Installing or uninstalling an extension creates a migration in your project.',
      ),
    ).toBeInTheDocument();
  });

  it('filters the table by name, comment, and display name while popular cards stay', async () => {
    const user = new TestUserEvent();
    const all = await renderPage();
    const search = screen.getByRole('textbox', { name: 'Search extensions' });

    await user.type(search, 'pgvector');

    expect(
      within(all)
        .getAllByTestId(/^extension-row-/)
        .map((row) => row.getAttribute('data-testid')),
    ).toEqual(['extension-row-vector']);
    expect(
      screen.getByRole('region', { name: 'Popular extensions' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('extension-card-postgis')).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'case-insensitive');
    expect(getRow(all, 'citext')).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'missing extension');

    expect(within(all).getByText('No matching extensions')).toBeInTheDocument();
    expect(screen.getByTestId('extension-card-vector')).toBeInTheDocument();
  });

  it('links extension names to their documentation section', async () => {
    const all = await renderPage();

    expect(
      within(getRow(all, 'pg_cron')).getByRole('link', { name: 'pg_cron' }),
    ).toHaveAttribute(
      'href',
      'https://docs.nhost.io/products/database/extensions#pg_cron',
    );
    expect(
      within(getRow(all, 'vector')).getByRole('link', { name: 'pgvector' }),
    ).toHaveAttribute(
      'href',
      'https://docs.nhost.io/products/database/extensions#pgvector',
    );
  });

  it('locks built-in extensions instead of offering uninstall', async () => {
    const all = await renderPage();
    const citext = getRow(all, 'citext');

    expect(within(citext).getByText('Built-in')).toBeInTheDocument();
    expect(
      within(citext).queryByTestId('uninstall-extension-citext'),
    ).not.toBeInTheDocument();
  });

  it('throws catalog errors to the error boundary', async () => {
    server.use(
      http.post(`${HASURA_URL}/v2/query`, () =>
        HttpResponse.json(
          { code: 'not-exists', error: 'source does not exist', path: '$' },
          { status: 400 },
        ),
      ),
    );

    render(<DatabaseExtensions />);

    expect(
      await screen.findByText('source does not exist'),
    ).toBeInTheDocument();
  });

  describe('install', () => {
    it('saves the edited SQL as a migration when running locally', async () => {
      const user = new TestUserEvent();
      const all = await renderPage();
      const dialog = await openInstallDialog(user, all, 'uuid-ossp');
      const editor = within(dialog).getByRole('textbox', { name: 'SQL' });
      const sql = `-- pinned\n${getInstallExtensionSQL('uuid-ossp')}`;

      expect(editor).toHaveValue(getInstallExtensionSQL('uuid-ossp'));

      await user.clear(editor);
      await user.paste(sql);
      const catalogRequestsBefore = catalogRequests;
      await user.click(within(dialog).getByTestId('confirm-install-extension'));

      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
      );
      expect(writeRequests).toEqual([
        {
          url: MIGRATIONS_URL,
          body: buildExtensionMigration(
            { name: 'uuid-ossp', installed: true, sql },
            'default',
          ),
        },
      ]);
      expect(catalogRequests).toBeGreaterThan(catalogRequestsBefore);
      expect(
        await screen.findByText('uuid-ossp has been installed.'),
      ).toBeInTheDocument();
    });

    it('cannot be dismissed while running and shows errors inline', async () => {
      const user = new TestUserEvent();
      let respond: VoidFunction = () => undefined;
      const responded = new Promise<void>((resolve) => {
        respond = resolve;
      });
      server.use(
        http.post(MIGRATIONS_URL, async () => {
          await responded;

          return migrationError(
            '0A000',
            'extension "pg_cron" must be loaded first',
          );
        }),
      );
      const dialog = await openInstallDialog(
        user,
        await renderPage(),
        'pg_cron',
      );
      await waitUntilInstallable(dialog);

      await user.click(within(dialog).getByTestId('confirm-install-extension'));
      await waitFor(() =>
        expect(
          within(dialog).getByRole('button', { name: 'Cancel' }),
        ).toBeDisabled(),
      );
      await user.keyboard('{Escape}');

      expect(screen.getByRole('dialog')).toBeInTheDocument();

      respond();

      expect(
        await within(dialog).findByText(
          'extension "pg_cron" must be loaded first',
        ),
      ).toBeInTheDocument();
      expect(
        within(dialog).getByTestId('confirm-install-extension'),
      ).toBeEnabled();
    });

    it('starts from freshly generated SQL every time it opens', async () => {
      const user = new TestUserEvent();
      const all = await renderPage();
      let dialog = await openInstallDialog(user, all, 'hstore');

      await user.clear(within(dialog).getByRole('textbox', { name: 'SQL' }));
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
      );
      expect(within(all).getByTestId('install-extension-hstore')).toHaveFocus();
      dialog = await openInstallDialog(user, all, 'hstore');

      expect(within(dialog).getByRole('textbox', { name: 'SQL' })).toHaveValue(
        getInstallExtensionSQL('hstore'),
      );
      expect(dialog).not.toHaveTextContent('Also installs');
    });

    it('installs missing dependencies with CASCADE', async () => {
      const user = new TestUserEvent();
      const dialog = await openInstallDialog(
        user,
        await renderPage(),
        'earthdistance',
      );

      expect(within(dialog).getByRole('textbox', { name: 'SQL' })).toHaveValue(
        getInstallExtensionSQL('earthdistance', { cascade: true }),
      );
      expect(dialog).toHaveTextContent(
        'Also installs cube, which earthdistance depends on.',
      );
    });
  });

  describe('preloaded libraries', () => {
    it('marks the preload step done when Postgres already loads the library', async () => {
      const user = new TestUserEvent();
      const dialog = await openInstallDialog(
        user,
        await renderPage(),
        'pg_cron',
      );

      await waitUntilInstallable(dialog);
      expect(getPreloadStep(dialog)).toHaveAttribute('data-state', 'complete');
      expect(getPreloadStep(dialog)).toHaveTextContent(
        'Postgres loads pg_cron at startup.',
      );
      expect(configUpdates).toEqual([]);
    });

    it('adds the library locally and installs after nhost up', async () => {
      const user = new TestUserEvent();
      const dialog = await openInstallDialog(
        user,
        await renderPage(),
        'pg_ivm',
      );

      await user.click(
        await within(dialog).findByRole('button', {
          name: 'Add to preloaded libraries',
        }),
      );

      expect(await within(dialog).findByText('$ nhost up')).toBeInTheDocument();
      expect(configUpdates).toEqual([
        {
          postgres: {
            settings: {
              sharedPreloadLibraries: [
                ...DEFAULT_PRELOADED_LIBRARIES,
                'pg_ivm',
              ],
            },
          },
        },
      ]);
      expect(getInstallButton(dialog)).toBeDisabled();

      await user.click(
        within(dialog).getByRole('button', { name: 'Check again' }),
      );

      await waitFor(() =>
        expect(getPreloadStep(dialog)).toHaveTextContent(
          'Postgres has not loaded pg_ivm yet.',
        ),
      );

      preloadedLibraries = [...preloadedLibraries, 'pg_ivm'];
      await user.click(
        within(dialog).getByRole('button', { name: 'Check again' }),
      );

      await waitUntilInstallable(dialog);
      expect(getPreloadStep(dialog)).toHaveAttribute('data-state', 'complete');
      expect(getInstallButton(dialog)).toHaveFocus();

      await user.click(getInstallButton(dialog));

      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
      );
      expect(writeRequests).toEqual([
        {
          url: MIGRATIONS_URL,
          body: buildExtensionMigration(
            {
              name: 'pg_ivm',
              installed: true,
              sql: getInstallExtensionSQL('pg_ivm'),
            },
            'default',
          ),
        },
      ]);
    });

    it('waits for the platform restart before enabling install', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      try {
        const user = new TestUserEvent({
          advanceTimers: vi.advanceTimersByTime,
        });
        mocks.useIsPlatform.mockReturnValue(true);
        configuredLibraries = ['pg_cron'];
        const dialog = await openInstallDialog(
          user,
          await renderPage(),
          'pg_ivm',
        );

        await user.click(
          await within(dialog).findByRole('button', {
            name: 'Add to preloaded libraries',
          }),
        );

        expect(
          await within(dialog).findByText(
            'Restarting Postgres to load pg_ivm...',
          ),
        ).toBeInTheDocument();
        expect(configUpdates).toEqual([
          {
            postgres: {
              settings: { sharedPreloadLibraries: ['pg_cron', 'pg_ivm'] },
            },
          },
        ]);
        expect(getInstallButton(dialog)).toBeDisabled();

        preloadedLibraries = [...preloadedLibraries, 'pg_ivm'];
        await act(() => vi.advanceTimersByTimeAsync(10_000));

        await waitUntilInstallable(dialog);
        expect(getPreloadStep(dialog)).toHaveAttribute(
          'data-state',
          'complete',
        );
      } finally {
        vi.useRealTimers();
      }
    });

    it('keeps waiting for a restart started earlier', async () => {
      const user = new TestUserEvent();
      mocks.useIsPlatform.mockReturnValue(true);
      configuredLibraries = [...DEFAULT_PRELOADED_LIBRARIES, 'pg_ivm'];
      const dialog = await openInstallDialog(
        user,
        await renderPage(),
        'pg_ivm',
      );

      expect(
        await within(dialog).findByText(
          'Restarting Postgres to load pg_ivm...',
        ),
      ).toBeInTheDocument();
      expect(
        within(dialog).queryByRole('button', { name: /^Add/ }),
      ).not.toBeInTheDocument();
      expect(getInstallButton(dialog)).toBeDisabled();
    });

    it('stops waiting when deploying the new settings fails', async () => {
      const user = new TestUserEvent();
      mocks.useIsPlatform.mockReturnValue(true);
      mocks.useAppState.mockReturnValue({
        state: ApplicationStatus.Errored,
        project: {
          appStates: [{ message: 'invalid configuration' }],
        },
      });
      configuredLibraries = [...DEFAULT_PRELOADED_LIBRARIES, 'pg_ivm'];
      const dialog = await openInstallDialog(
        user,
        await renderPage(),
        'pg_ivm',
      );

      expect(
        await within(dialog).findByText('Postgres did not restart'),
      ).toBeInTheDocument();
      expect(dialog).toHaveTextContent('invalid configuration');
      expect(
        within(getPreloadStep(dialog)).queryByRole('progressbar'),
      ).not.toBeInTheDocument();
      expect(getInstallButton(dialog)).toBeDisabled();
    });

    it('does not change the libraries when the settings fail to load', async () => {
      const user = new TestUserEvent();
      server.use(
        nhostGraphQLLink.query('GetConfiguredPreloadLibraries', () =>
          HttpResponse.json({ errors: [{ message: 'config unavailable' }] }),
        ),
      );
      const dialog = await openInstallDialog(
        user,
        await renderPage(),
        'pg_ivm',
      );

      expect(
        await within(dialog).findByText(/Could not load the project settings/),
      ).toBeInTheDocument();
      expect(
        within(dialog).queryByRole('button', { name: /^Add/ }),
      ).not.toBeInTheDocument();
      expect(getInstallButton(dialog)).toBeDisabled();
    });
  });

  describe('uninstall', () => {
    it('runs through the schema API on the platform', async () => {
      const user = new TestUserEvent();
      mocks.useIsPlatform.mockReturnValue(true);
      const all = await renderPage();

      await user.click(within(all).getByTestId('uninstall-extension-postgis'));
      const dialog = await screen.findByRole('alertdialog');
      await user.click(
        within(dialog).getByTestId('confirm-uninstall-extension'),
      );

      await waitFor(() =>
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
      );
      expect(writeRequests).toEqual([
        {
          url: `${HASURA_URL}/v2/query`,
          body: {
            type: 'bulk',
            version: 1,
            args: buildExtensionMigration(
              {
                name: 'postgis',
                installed: false,
                sql: getUninstallExtensionSQL('postgis'),
              },
              'default',
            ).up,
          },
        },
      ]);
      expect(
        await screen.findByText('postgis has been uninstalled.'),
      ).toBeInTheDocument();
      expect(screen.queryByText(/creates a migration/)).not.toBeInTheDocument();
    });

    it('records the edited SQL as a migration', async () => {
      const user = new TestUserEvent();
      const all = await renderPage();

      await user.click(within(all).getByTestId('uninstall-extension-postgis'));
      const dialog = await screen.findByRole('alertdialog');
      const editor = within(dialog).getByRole('textbox', { name: 'SQL' });
      const sql = getUninstallExtensionSQL('postgis').replace(
        'postgis;',
        'postgis CASCADE;',
      );

      expect(editor).toHaveValue(getUninstallExtensionSQL('postgis'));

      await user.clear(editor);
      await user.paste(sql);
      await user.click(
        within(dialog).getByTestId('confirm-uninstall-extension'),
      );

      await waitFor(() =>
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
      );
      expect(writeRequests).toEqual([
        {
          url: MIGRATIONS_URL,
          body: buildExtensionMigration(
            { name: 'postgis', installed: false, sql },
            'default',
          ),
        },
      ]);
      expect(
        (writeRequests[0].body as ReturnType<typeof buildExtensionMigration>)
          .down[0].args.sql,
      ).toBe(getInstallExtensionSQL('postgis'));
    });

    it('stays open and explains how to drop dependent objects', async () => {
      const user = new TestUserEvent();
      server.use(
        http.post(MIGRATIONS_URL, () =>
          migrationError(
            '2BP01',
            'cannot drop extension postgis because other objects depend on it',
          ),
        ),
      );
      const all = await renderPage();

      await user.click(within(all).getByTestId('uninstall-extension-postgis'));
      const dialog = await screen.findByRole('alertdialog');
      await user.click(
        within(dialog).getByTestId('confirm-uninstall-extension'),
      );

      expect(
        await within(dialog).findByText(
          'cannot drop extension postgis because other objects depend on it',
        ),
      ).toBeInTheDocument();
      expect(dialog).toHaveTextContent(
        'Remove the dependent objects first, or add CASCADE to the SQL above',
      );
    });

    it('shows other errors without the dependent objects advice', async () => {
      const user = new TestUserEvent();
      server.use(http.post(MIGRATIONS_URL, () => HttpResponse.error()));
      const all = await renderPage();

      await user.click(within(all).getByTestId('uninstall-extension-postgis'));
      const dialog = await screen.findByRole('alertdialog');
      await user.click(
        within(dialog).getByTestId('confirm-uninstall-extension'),
      );

      expect(
        await within(dialog).findByText('Could not uninstall postgis'),
      ).toBeInTheDocument();
      expect(dialog).not.toHaveTextContent('Remove the dependent objects');
    });

    it('drops pg_durable with CASCADE after warning about its workflow state', async () => {
      const user = new TestUserEvent();
      mocks.useIsPlatform.mockReturnValue(true);
      const all = await renderPage();

      await user.click(
        within(all).getByTestId('uninstall-extension-pg_durable'),
      );
      const dialog = await screen.findByRole('alertdialog');

      expect(within(dialog).getByRole('textbox', { name: 'SQL' })).toHaveValue(
        getUninstallExtensionSQL('pg_durable'),
      );
      expect(dialog).toHaveTextContent(/deletes all pg_durable workflow state/);
      expect(
        within(dialog).getByRole('link', {
          name: 'Point-in-time recovery settings',
        }),
      ).toHaveAttribute('href', '/orgs/local/projects/local/settings/database');

      await user.click(
        within(dialog).getByTestId('confirm-uninstall-extension'),
      );

      await waitFor(() =>
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
      );
      expect(writeRequests).toEqual([
        {
          url: `${HASURA_URL}/v2/query`,
          body: {
            type: 'bulk',
            version: 1,
            args: buildExtensionMigration(
              {
                name: 'pg_durable',
                installed: false,
                sql: getUninstallExtensionSQL('pg_durable'),
              },
              'default',
            ).up,
          },
        },
      ]);
    });
  });
});

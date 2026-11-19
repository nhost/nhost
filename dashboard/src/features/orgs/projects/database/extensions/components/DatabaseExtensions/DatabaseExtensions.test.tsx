import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { toast } from 'react-hot-toast';
import { DatabaseExtensions } from '@/features/orgs/projects/database/extensions/components/DatabaseExtensions';
import { DEFAULT_PRELOADED_LIBRARIES } from '@/features/orgs/projects/database/extensions/constants';
import type { PostgresExtension } from '@/features/orgs/projects/database/extensions/hooks/usePostgresExtensionsQuery';
import { buildExtensionMigration } from '@/features/orgs/projects/database/extensions/hooks/useSetExtensionInstalledMutation';
import { getInstallExtensionSQL } from '@/features/orgs/projects/database/extensions/utils/getInstallExtensionSQL';
import { getUninstallExtensionSQL } from '@/features/orgs/projects/database/extensions/utils/getUninstallExtensionSQL';
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

vi.mock('@uiw/react-codemirror', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@uiw/react-codemirror')>()),
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

function extension(
  name: string,
  comment: string,
  { installed = false, requires = [] as string[] } = {},
): PostgresExtension {
  return {
    name,
    default_version: '1.0',
    installed_version: installed ? '1.0' : null,
    comment,
    requires,
  };
}

const catalog = [
  extension('citext', 'case-insensitive character strings', {
    installed: true,
  }),
  extension('cube', 'multidimensional cubes'),
  extension('earthdistance', 'great-circle distances', { requires: ['cube'] }),
  extension('hstore', 'sets of key/value pairs'),
  extension('pg_cron', 'job scheduler'),
  extension('pg_durable', 'durable orchestrations'),
  extension('postgis', 'spatial types', { installed: true }),
  extension('uuid-ossp', 'universally unique identifiers'),
  extension('vector', 'vector data type'),
];

function setInstalledInCatalog(name: string, installed: boolean) {
  catalogRows = catalogRows.map((row) =>
    row.name === name
      ? { ...row, installed_version: installed ? row.default_version : null }
      : row,
  );
}

// Applies the extension statement of a write to the catalog, like Postgres.
function applyToCatalog(sql: string) {
  const [, action, name] =
    /(CREATE|DROP) EXTENSION IF (?:NOT )?EXISTS "?([\w-]+)"?/.exec(sql)!;
  setInstalledInCatalog(name, action === 'CREATE');
}

let catalogRows = catalog;
let writeRequests: Array<{ url: string; body: unknown }> = [];
let preloadedLibraries: string[] = [];
// `null` mirrors a project that never set `sharedPreloadLibraries`.
let configuredLibraries: string[] | null = null;
let configUpdates: unknown[] = [];

// The migrations API wraps the Hasura error in a JSON `message` string.
function migrationError(
  status_code: string,
  message: string,
  description?: string,
) {
  const error = {
    code: 'postgres-error',
    error: 'query execution failed',
    path: '$.args[0].args',
    internal: {
      error: { status_code, message, description, exec_status: 'FatalError' },
    },
  };

  return HttpResponse.json(
    { code: 'unexpected', message: JSON.stringify(error) },
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
          result: [['trim'], ...preloadedLibraries.map((library) => [library])],
        },
      ]);
    }

    if (readOnly) {
      return HttpResponse.json([
        {
          result_type: 'TuplesOk',
          result: [
            ['data'],
            ...catalogRows.map((row) => [JSON.stringify(row)]),
          ],
        },
      ]);
    }

    writeRequests.push({ url: request.url, body });
    applyToCatalog(sql);

    return HttpResponse.json([{ result_type: 'CommandOk', result: null }]);
  }),
  http.post(MIGRATIONS_URL, async ({ request }) => {
    const body = (await request.json()) as {
      up: Array<{ args: { sql: string } }>;
    };
    writeRequests.push({ url: request.url, body });
    applyToCatalog(body.up[0].args.sql);

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
  catalogRows = catalog;
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

const COMPLETED_PRELOAD_STEP = { name: /^Step 1 \(completed\):/ };

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

    await user.clear(search);
    await user.type(search, 'case-insensitive');
    expect(getRow(all, 'citext')).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'missing extension');

    expect(within(all).getByText('No matching extensions')).toBeInTheDocument();
    expect(screen.getByTestId('extension-card-vector')).toBeInTheDocument();
  });

  it('marks installed extensions and filters the table by install state', async () => {
    const user = new TestUserEvent();
    const all = await renderPage();

    expect(within(getRow(all, 'postgis')).getByText('Installed')).toBeVisible();
    expect(
      within(getRow(all, 'cube')).queryByText('Installed'),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /^Installed/ }));

    expect(
      within(all)
        .getAllByTestId(/^extension-row-/)
        .map((row) => row.getAttribute('data-testid')),
    ).toEqual(['extension-row-citext', 'extension-row-postgis']);
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

  it('keeps the loaded page and the dialog when refreshing the catalog fails', async () => {
    const user = new TestUserEvent();
    const all = await renderPage();
    const dialog = await openInstallDialog(user, all, 'hstore');
    let failedCatalogRequests = 0;
    server.use(
      http.post(`${HASURA_URL}/v2/query`, async ({ request }) => {
        const { args } = (await request.json()) as {
          args: Array<{ args: { sql: string } }>;
        };

        if (args[0].args.sql.includes('pg_available_extensions')) {
          failedCatalogRequests += 1;
        }

        return HttpResponse.json(
          { code: 'unexpected', error: 'database is restarting', path: '$' },
          { status: 500 },
        );
      }),
      http.post(MIGRATIONS_URL, () =>
        migrationError('57P03', 'the database system is starting up'),
      ),
    );

    await user.click(getInstallButton(dialog));

    expect(
      await within(dialog).findByText('the database system is starting up'),
    ).toBeInTheDocument();
    expect(failedCatalogRequests).toBeGreaterThan(0);
    expect(all).toBeInTheDocument();
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
      const row = getRow(all, 'uuid-ossp');
      expect(await within(row).findByText('Installed')).toBeInTheDocument();
      expect(
        within(row).getByRole('button', { name: 'Uninstall uuid-ossp' }),
      ).toBeInTheDocument();
      expect(
        await screen.findByText('uuid-ossp has been installed.'),
      ).toBeInTheDocument();
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
    it('adds the library locally and enables install after nhost up', async () => {
      const user = new TestUserEvent();
      const dialog = await openInstallDialog(
        user,
        await renderPage(),
        'pg_durable',
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
                'pg_durable',
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
          'Postgres has not loaded pg_durable yet.',
        ),
      );

      preloadedLibraries = [...preloadedLibraries, 'pg_durable'];
      await user.click(
        within(dialog).getByRole('button', { name: 'Check again' }),
      );

      await waitUntilInstallable(dialog);
      expect(
        within(dialog).getByRole('heading', COMPLETED_PRELOAD_STEP),
      ).toBeInTheDocument();
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
          'pg_durable',
        );

        await user.click(
          await within(dialog).findByRole('button', {
            name: 'Add to preloaded libraries',
          }),
        );

        expect(
          await within(dialog).findByText(
            'Restarting Postgres to load pg_durable...',
          ),
        ).toBeInTheDocument();
        expect(configUpdates).toEqual([
          {
            postgres: {
              settings: { sharedPreloadLibraries: ['pg_cron', 'pg_durable'] },
            },
          },
        ]);
        expect(getInstallButton(dialog)).toBeDisabled();

        preloadedLibraries = [...preloadedLibraries, 'pg_durable'];
        await act(() => vi.advanceTimersByTimeAsync(10_000));

        await waitUntilInstallable(dialog);
        expect(
          within(dialog).getByRole('heading', COMPLETED_PRELOAD_STEP),
        ).toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });

    it('cannot be dismissed while adding the library and shows errors inline', async () => {
      const user = new TestUserEvent();
      let respond: VoidFunction = () => undefined;
      const responded = new Promise<void>((resolve) => {
        respond = resolve;
      });
      server.use(
        nhostGraphQLLink.mutation('UpdateConfig', async () => {
          await responded;

          return HttpResponse.json({
            errors: [{ message: 'config update rejected' }],
          });
        }),
      );
      const dialog = await openInstallDialog(
        user,
        await renderPage(),
        'pg_durable',
      );

      await user.click(
        await within(dialog).findByRole('button', {
          name: 'Add to preloaded libraries',
        }),
      );
      await waitFor(() =>
        expect(
          within(dialog).getByRole('button', { name: 'Cancel' }),
        ).toBeDisabled(),
      );
      await user.keyboard('{Escape}');

      expect(screen.getByRole('dialog')).toBeInTheDocument();

      respond();

      expect(
        await within(dialog).findByText('config update rejected'),
      ).toBeInTheDocument();
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
      configuredLibraries = [...DEFAULT_PRELOADED_LIBRARIES, 'pg_durable'];
      const dialog = await openInstallDialog(
        user,
        await renderPage(),
        'pg_durable',
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

    it('warns about an installed extension Postgres does not preload until it is preloaded', async () => {
      const user = new TestUserEvent();
      setInstalledInCatalog('pg_cron', true);
      preloadedLibraries = ['pg_stat_statements'];
      configuredLibraries = ['pg_stat_statements'];
      const all = await renderPage();

      expect(await screen.findByRole('alert')).toHaveTextContent(
        "1 installed extension isn't preloaded",
      );

      await user.click(
        within(getRow(all, 'pg_cron')).getByRole('button', {
          name: 'pg_cron library not preloaded',
        }),
      );
      await user.click(
        screen.getByRole('button', { name: 'Add to preloaded libraries…' }),
      );
      const dialog = await screen.findByRole('dialog');
      await user.click(
        await within(dialog).findByRole('button', {
          name: 'Add to preloaded libraries',
        }),
      );

      const checkAgain = await within(dialog).findByRole('button', {
        name: 'Check again',
      });
      preloadedLibraries = ['pg_stat_statements', 'pg_cron'];
      await user.click(checkAgain);
      await waitFor(() =>
        expect(dialog).toHaveTextContent('Postgres loads pg_cron at startup.'),
      );
      await user.keyboard('{Escape}');
      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
      );

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(
        within(getRow(all, 'pg_cron')).queryByRole('button', {
          name: 'pg_cron library not preloaded',
        }),
      ).not.toBeInTheDocument();
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
        'pg_durable',
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
      const row = getRow(all, 'postgis');
      expect(
        await within(row).findByRole('button', { name: 'Install postgis' }),
      ).toBeInTheDocument();
      expect(within(row).queryByText('Installed')).not.toBeInTheDocument();
      expect(
        await screen.findByText('postgis has been uninstalled.'),
      ).toBeInTheDocument();
      expect(screen.queryByText(/creates a migration/)).not.toBeInTheDocument();
    });

    it('explains what CASCADE drops and shows the object that blocks the uninstall', async () => {
      const user = new TestUserEvent();
      server.use(
        http.post(MIGRATIONS_URL, () =>
          migrationError(
            '2BP01',
            'cannot drop extension postgis because other objects depend on it',
            'column geom of table places depends on type geometry',
          ),
        ),
      );
      const all = await renderPage();

      await user.click(within(all).getByTestId('uninstall-extension-postgis'));
      const dialog = await screen.findByRole('alertdialog');

      expect(dialog).toHaveTextContent(
        'With CASCADE, those objects and their data are dropped too.',
      );

      await user.click(
        within(dialog).getByTestId('confirm-uninstall-extension'),
      );

      expect(
        await within(dialog).findByText(
          'column geom of table places depends on type geometry',
        ),
      ).toBeInTheDocument();
    });

    it('warns about the workflow state before dropping pg_durable with CASCADE', async () => {
      const user = new TestUserEvent();
      mocks.useIsPlatform.mockReturnValue(true);
      setInstalledInCatalog('pg_durable', true);
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
      ).toHaveAttribute(
        'href',
        '/orgs/local/projects/local/database/settings?tab=point-in-time',
      );
    });
  });
});

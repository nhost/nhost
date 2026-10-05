import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { toast } from 'react-hot-toast';
import { DatabaseExtensions } from '@/features/orgs/projects/database/extensions/components/DatabaseExtensions';
import type { PostgresExtension } from '@/features/orgs/projects/database/extensions/hooks/usePostgresExtensionsQuery';
import {
  buildExtensionMigration,
  getInstallExtensionSQL,
} from '@/features/orgs/projects/database/extensions/hooks/useSetExtensionInstalledMutation';
import { mockMatchMediaValue } from '@/tests/mocks';
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

const HASURA_URL = 'https://local.hasura.local.nhost.run';
const MIGRATIONS_URL = `${HASURA_URL}/apis/migrate`;

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
  useIsPlatform: vi.fn(),
  useProject: vi.fn(),
}));

vi.mock('next/router', () => ({ useRouter: mocks.useRouter }));

vi.mock('@/features/orgs/projects/common/hooks/useIsPlatform', () => ({
  useIsPlatform: mocks.useIsPlatform,
}));

vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: mocks.useProject,
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
    versions: ['1.6'],
  },
  {
    name: 'hstore',
    default_version: '1.8',
    installed_version: null,
    comment: 'data type for storing sets of key/value pairs',
    versions: ['1.8'],
  },
  {
    name: 'pg_cron',
    default_version: '1.6',
    installed_version: null,
    comment: 'job scheduler for PostgreSQL',
    versions: ['1.6', '1.5'],
  },
  {
    name: 'postgis',
    default_version: '3.6.1',
    installed_version: '3.6.1',
    comment: 'PostGIS geometry and geography spatial types and functions',
    versions: ['3.6.1'],
  },
  {
    name: 'uuid-ossp',
    default_version: '1.1',
    installed_version: null,
    comment: 'generate universally unique identifiers',
    versions: ['1.1'],
  },
  {
    name: 'vector',
    default_version: '0.8.1',
    installed_version: null,
    comment: 'vector data type and ivfflat and hnsw access methods',
    versions: ['0.8.1'],
  },
];

let catalogRequests = 0;
let writeRequests: Array<{ url: string; body: unknown }> = [];

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
      args: Array<{ args: { read_only: boolean } }>;
    };

    if (body.args[0].args.read_only) {
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
  mocks.useProject.mockReturnValue({
    project: {
      subdomain: 'local',
      region: { name: 'local', domain: 'local.nhost.run' },
      config: { hasura: { adminSecret: 'nhost-admin-secret' } },
    },
  });
  catalogRequests = 0;
  writeRequests = [];
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

function getCard(region: HTMLElement, name: string) {
  return within(region).getByTestId(`extension-card-${name}`);
}

async function openTooltip(trigger: HTMLElement) {
  act(() => trigger.focus());

  return screen.findByRole('tooltip');
}

async function openInstallDialog(
  user: TestUserEvent,
  region: HTMLElement,
  name: string,
) {
  await user.click(within(region).getByTestId(`install-extension-${name}`));

  return screen.findByRole('dialog');
}

describe('DatabaseExtensions', () => {
  it('lists Popular extensions first and every extension under All', async () => {
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
    expect(within(all).getAllByTestId(/^extension-card-/)).toHaveLength(
      catalog.length,
    );
    expect(
      screen.getByText(
        'Installing or uninstalling an extension creates a migration in your project.',
      ),
    ).toBeInTheDocument();
  });

  it('searches a single deduplicated list by name, comment, and display name', async () => {
    const user = new TestUserEvent();
    await renderPage();
    const search = screen.getByRole('textbox', { name: 'Search extensions' });

    await user.type(search, 'pgvector');

    expect(
      screen.queryByRole('region', { name: 'Popular extensions' }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByTestId('extension-card-vector')).toHaveLength(1);
    expect(
      screen.queryByTestId('extension-card-postgis'),
    ).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'case-insensitive');
    expect(screen.getByTestId('extension-card-citext')).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'missing extension');

    expect(screen.getByText('No matching extensions')).toBeInTheDocument();
  });

  it('links extension names to their documentation section', async () => {
    const all = await renderPage();

    expect(
      within(getCard(all, 'pg_cron')).getByRole('link', { name: 'pg_cron' }),
    ).toHaveAttribute(
      'href',
      'https://docs.nhost.io/products/database/extensions#pg_cron',
    );
    expect(
      within(getCard(all, 'vector')).getByRole('link', { name: 'pgvector' }),
    ).toHaveAttribute(
      'href',
      'https://docs.nhost.io/products/database/extensions#pgvector',
    );
  });

  it('explains the preload requirement in a tooltip', async () => {
    const all = await renderPage();
    const tooltip = await openTooltip(
      within(getCard(all, 'pg_cron')).getByRole('button', {
        name: 'Preload requirement',
      }),
    );

    expect(tooltip).toHaveTextContent(
      'Requires shared_preload_libraries, which Nhost preloads by default.',
    );
  });

  it('locks built-in extensions instead of offering uninstall', async () => {
    const all = await renderPage();
    const citext = getCard(all, 'citext');

    expect(citext).toHaveAttribute('data-built-in', 'true');
    expect(
      within(citext).queryByTestId('uninstall-extension-citext'),
    ).not.toBeInTheDocument();

    const tooltip = await openTooltip(
      within(citext).getByRole('button', { name: 'Built-in' }),
    );

    expect(tooltip).toHaveTextContent(/^Cannot be uninstalled\./);
  });

  it('throws catalog errors to the error boundary', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
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
      expect(
        within(dialog).queryByRole('combobox', { name: 'Version' }),
      ).not.toBeInTheDocument();

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

    it('regenerates the SQL for the selected version', async () => {
      const user = new TestUserEvent();
      const dialog = await openInstallDialog(
        user,
        await renderPage(),
        'pg_cron',
      );
      const editor = within(dialog).getByRole('textbox', { name: 'SQL' });
      const versionSelect = within(dialog).getByRole('combobox', {
        name: 'Version',
      });

      expect(versionSelect).toHaveTextContent('1.6 (default)');

      await user.click(versionSelect);
      await user.click(await screen.findByRole('option', { name: '1.5' }));

      expect(editor).toHaveValue(getInstallExtensionSQL('pg_cron', '1.5'));

      await user.click(versionSelect);
      await user.click(
        await screen.findByRole('option', { name: '1.6 (default)' }),
      );

      expect(editor).toHaveValue(getInstallExtensionSQL('pg_cron'));
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
      dialog = await openInstallDialog(user, all, 'hstore');

      expect(within(dialog).getByRole('textbox', { name: 'SQL' })).toHaveValue(
        getInstallExtensionSQL('hstore'),
      );
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
              { name: 'postgis', installed: false },
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

    it('stays open with the dependents error and a link to the SQL editor', async () => {
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
      expect(
        within(dialog).getByRole('link', { name: 'SQL editor' }),
      ).toHaveAttribute(
        'href',
        '/orgs/local/projects/local/database/browser/default/editor',
      );
    });
  });
});

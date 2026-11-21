import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { toast } from 'react-hot-toast';
import SqlJobs from '@/features/orgs/projects/events/sql-jobs/components/SqlJobs';
import {
  cronStateFixture,
  sqlJobFixture,
} from '@/features/orgs/projects/events/sql-jobs/test-fixtures';
import type {
  CronState,
  SqlJob,
} from '@/features/orgs/projects/events/sql-jobs/types';
import { mockMatchMediaValue } from '@/tests/mocks';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import {
  mockScrollIntoViewAndPointerCapture,
  queryClient,
  render,
  screen,
  TestUserEvent,
  waitFor,
  within,
} from '@/tests/testUtils';
import { ApplicationStatus } from '@/types/application';

const mocks = vi.hoisted(() => ({ platform: vi.fn(), project: vi.fn() }));
vi.mock('next/router', () => ({
  useRouter: () => ({
    query: {
      orgSlug: 'local',
      appSubdomain: 'local',
      dataSourceSlug: 'default',
    },
  }),
}));
vi.mock('@/features/orgs/projects/common/hooks/useIsPlatform', () => ({
  useIsPlatform: mocks.platform,
}));
vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: mocks.project,
}));
vi.mock('@/features/orgs/projects/common/hooks/useAppState', () => ({
  useAppState: () => ({ state: ApplicationStatus.Live }),
}));
vi.mock('@/features/orgs/projects/hooks/useLocalMimirClient', () => ({
  useLocalMimirClient: () => undefined,
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

const HASURA_URL = 'https://local.hasura.local.nhost.run';
let installed = true;
let jobs: SqlJob[] = [];
let state: CronState = cronStateFixture;
let writes: Array<{ url: string; body: unknown }> = [];
let configured = { timezone: 'GMT', maxRunningJobs: 32, logRun: 'on' };
let configWrites: unknown[] = [];

function rows(data: unknown[]) {
  return {
    result_type: 'TuplesOk',
    result: [['data'], ...data.map((value) => [JSON.stringify(value)])],
  };
}

const server = setupServer(
  http.post(`${HASURA_URL}/v2/query`, async ({ request }) => {
    const body = (await request.json()) as {
      type: string;
      args:
        | { read_only: boolean; sql: string }
        | Array<{ args: { sql: string } }>;
    };
    if (Array.isArray(body.args)) {
      const sql = body.args[0].args.sql;
      if (sql.includes('shared_preload_libraries')) {
        return HttpResponse.json([
          { result_type: 'TuplesOk', result: [['trim'], ['pg_cron']] },
        ]);
      }
      return HttpResponse.json([
        rows([
          {
            name: 'pg_cron',
            default_version: '1.6',
            installed_version: installed ? '1.6' : null,
            comment: 'Job scheduler',
            requires: [],
          },
        ]),
      ]);
    }
    const { sql, read_only } = body.args;
    if (!read_only) {
      writes.push({ url: request.url, body });
      return HttpResponse.json({ result_type: 'CommandOk', result: null });
    }
    if (sql.includes('pg_settings')) {
      return HttpResponse.json(rows([state]));
    }
    if (sql.includes('FROM cron.job job')) {
      return HttpResponse.json(rows(jobs));
    }
    return HttpResponse.json(
      rows([
        {
          runid: '123',
          jobid: sqlJobFixture.jobid,
          status: 'failed',
          start_time: '2026-01-01T10:00:00Z',
          end_time: '2026-01-01T10:00:01Z',
          command: 'SELECT 1',
          return_message: 'Permission denied',
        },
      ]),
    );
  }),
  http.post(`${HASURA_URL}/apis/migrate`, async ({ request }) => {
    const body = (await request.json()) as {
      up: Array<{ args: { sql: string } }>;
    };
    writes.push({ url: request.url, body });
    if (body.up[0].args.sql.includes('CREATE EXTENSION')) {
      installed = true;
    }
    return HttpResponse.json({ name: 'migration', version: 1 });
  }),
  nhostGraphQLLink.query('GetCronSettings', () =>
    HttpResponse.json({
      data: {
        config: {
          __typename: 'ConfigConfig',
          id: 'ConfigConfig',
          postgres: { settings: { extensions: { cron: configured } } },
        },
      },
    }),
  ),
  nhostGraphQLLink.query('GetConfiguredPreloadLibraries', () =>
    HttpResponse.json({
      data: {
        config: {
          __typename: 'ConfigConfig',
          id: 'ConfigConfig',
          postgres: { settings: { sharedPreloadLibraries: ['pg_cron'] } },
        },
      },
    }),
  ),
  nhostGraphQLLink.mutation('UpdateCronSettings', ({ variables }) => {
    configWrites.push(variables);
    configured = {
      timezone: variables.timezone,
      maxRunningJobs: variables.maxRunningJobs,
      logRun: variables.logRun,
    };
    return HttpResponse.json({
      data: { updateConfig: { __typename: 'ConfigConfig' } },
    });
  }),
);

beforeAll(() => {
  mockScrollIntoViewAndPointerCapture();
  server.listen({ onUnhandledRequest: 'error' });
});
beforeEach(() => {
  mocks.platform.mockReturnValue(false);
  mocks.project.mockReturnValue({
    project: {
      id: 'project-id',
      subdomain: 'local',
      region: { name: 'local', domain: 'local.nhost.run' },
      config: { hasura: { adminSecret: 'nhost-admin-secret' } },
    },
  });
  installed = true;
  jobs = [{ ...sqlJobFixture }];
  state = cronStateFixture;
  writes = [];
  configured = { timezone: 'GMT', maxRunningJobs: 32, logRun: 'on' };
  configWrites = [];
});
afterEach(() => {
  server.resetHandlers();
  queryClient.clear();
  toast.remove();
});
afterAll(() => server.close());

async function page() {
  render(<SqlJobs />);
  return screen.findByRole('heading', { name: 'SQL Jobs' });
}

async function createJob(user: TestUserEvent) {
  await page();
  await user.click(
    await screen.findByRole('button', { name: 'Create SQL job' }),
  );
  const dialog = within(await screen.findByRole('dialog'));
  await user.type(dialog.getByLabelText('Job name'), 'nightly-cleanup');
  await user.type(dialog.getByLabelText('SQL command'), 'SELECT 1;\nSELECT 2;');
  await user.click(dialog.getByRole('button', { name: 'Create job' }));
  await waitFor(() => expect(writes).toHaveLength(1));
}

describe('SQL Jobs', () => {
  it('lists jobs, filters them, and opens run history with the original bigint ID', async () => {
    const user = new TestUserEvent();
    await page();
    await user.click(
      await screen.findByRole('button', { name: 'refresh-summary' }),
    );
    const sheet = within(await screen.findByRole('dialog'));
    expect(await sheet.findByText('Permission denied')).toBeInTheDocument();
    expect(
      sheet.getByRole('columnheader', { name: 'Started' }),
    ).toHaveAttribute('aria-sort', 'descending');
    expect(sheet.getByText(sqlJobFixture.jobid)).toBeInTheDocument();
    await user.click(sheet.getByRole('button', { name: 'Close' }));
    await user.click(
      screen.getByRole('radio', { name: 'Disabled', hidden: false }),
    );
    expect(
      await screen.findByText('No jobs match your search or filter.'),
    ).toBeInTheDocument();
  });

  it('creates local jobs with reversible Hasura migrations', async () => {
    await createJob(new TestUserEvent());
    expect(writes[0]).toMatchObject({
      url: `${HASURA_URL}/apis/migrate`,
      body: {
        name: 'create_sql_job_nightly_cleanup',
        datasource: 'default',
        skip_execution: false,
        up: [
          {
            type: 'run_sql',
            args: {
              source: 'default',
              read_only: false,
              sql: expect.stringContaining('cron.schedule_in_database'),
            },
          },
        ],
        down: [{ args: { sql: expect.stringContaining('cron.unschedule') } }],
      },
    });
  });

  it('creates hosted jobs with plain SQL', async () => {
    mocks.platform.mockReturnValue(true);
    await createJob(new TestUserEvent());
    expect(writes[0]).toMatchObject({
      url: `${HASURA_URL}/v2/query`,
      body: { type: 'run_sql', args: { read_only: false } },
    });
    expect(writes[0].body).not.toHaveProperty('up');
  });

  it('edits a job while keeping its name immutable', async () => {
    const user = new TestUserEvent();
    await page();
    await user.click(
      await screen.findByRole('button', { name: 'Edit refresh-summary' }),
    );
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByLabelText('Job name')).toBeDisabled();
    await user.clear(dialog.getByLabelText('Schedule'));
    await user.type(dialog.getByLabelText('Schedule'), '5 seconds');
    await user.click(dialog.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0].body).toMatchObject({
      up: [{ args: { sql: expect.stringContaining('5 seconds') } }],
      down: [{ args: { sql: expect.stringContaining('0 * * * *') } }],
    });
  });

  it('disables a job through a migration without deleting it', async () => {
    const user = new TestUserEvent();
    await page();
    await user.click(
      await screen.findByRole('button', { name: 'Disable refresh-summary' }),
    );
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0].body).toMatchObject({
      up: [{ args: { sql: expect.stringContaining('cron.alter_job') } }],
    });
  });

  it('requires confirmation before deleting a job', async () => {
    const user = new TestUserEvent();
    await page();
    await user.click(
      await screen.findByRole('button', { name: 'Delete refresh-summary' }),
    );
    expect(writes).toHaveLength(0);
    const dialog = within(await screen.findByRole('alertdialog'));
    await user.click(dialog.getByRole('button', { name: 'Delete job' }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0].body).toMatchObject({
      up: [{ args: { sql: expect.stringContaining('cron.unschedule') } }],
      down: [
        { args: { sql: expect.stringContaining('cron.schedule_in_database') } },
      ],
    });
  });

  it('warns before disabling pg_cron and saves job definitions in the down migration', async () => {
    const user = new TestUserEvent();
    await page();
    await user.click(
      await screen.findByRole('button', { name: 'Disable pg_cron' }),
    );
    const dialog = within(await screen.findByRole('alertdialog'));
    expect(
      dialog.getByText(
        /permanently deletes all SQL jobs and their run history/,
      ),
    ).toBeInTheDocument();
    await user.click(dialog.getByRole('button', { name: 'Disable pg_cron' }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0].body).toMatchObject({
      up: [
        {
          args: {
            sql: expect.stringContaining('DROP EXTENSION IF EXISTS pg_cron'),
          },
        },
      ],
      down: [{ args: { sql: expect.stringContaining('refresh-summary') } }],
    });
  });

  it('offers extension setup instead of querying missing cron tables', async () => {
    installed = false;
    await page();
    expect(
      screen.getByRole('button', { name: 'Enable pg_cron' }),
    ).toBeEnabled();
    expect(
      screen.getByText('Enable pg_cron to schedule SQL jobs'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Create SQL job' }),
    ).not.toBeInTheDocument();
  });

  it('enables pg_cron through the existing installer and a local migration', async () => {
    installed = false;
    const user = new TestUserEvent();
    await page();
    await user.click(screen.getByRole('button', { name: 'Enable pg_cron' }));
    const dialog = within(await screen.findByRole('dialog'));
    const install = await dialog.findByRole('button', { name: 'Install' });
    await waitFor(() => expect(install).toBeEnabled());
    await user.click(install);
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toMatchObject({
      url: `${HASURA_URL}/apis/migrate`,
      body: {
        up: [
          {
            args: {
              sql: expect.stringContaining(
                'CREATE EXTENSION IF NOT EXISTS pg_cron',
              ),
            },
          },
        ],
        down: [
          {
            args: {
              sql: expect.stringContaining('DROP EXTENSION IF EXISTS pg_cron'),
            },
          },
        ],
      },
    });
    expect(await screen.findByText('pg_cron enabled')).toBeInTheDocument();
  });

  it('keeps an edit open with its SQL intact when the migration fails', async () => {
    server.use(
      http.post(`${HASURA_URL}/apis/migrate`, () =>
        HttpResponse.json(
          {
            message: JSON.stringify({
              internal: { error: { message: 'Invalid cron expression' } },
            }),
          },
          { status: 400 },
        ),
      ),
    );
    const user = new TestUserEvent();
    await page();
    await user.click(
      await screen.findByRole('button', { name: 'Edit refresh-summary' }),
    );
    const dialog = within(await screen.findByRole('dialog'));
    await user.click(dialog.getByRole('button', { name: 'Save changes' }));
    expect(
      await dialog.findByText('Invalid cron expression'),
    ).toBeInTheDocument();
    expect(dialog.getByLabelText('SQL command')).toHaveValue(
      sqlJobFixture.command,
    );
  });

  it('does not save invalid scheduler settings', async () => {
    const user = new TestUserEvent();
    await page();
    await user.click(screen.getByRole('tab', { name: 'Settings' }));
    const timezone = await screen.findByLabelText('Timezone');
    await user.clear(timezone);
    await user.type(timezone, 'not-a-timezone');
    await user.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(
      await screen.findByText(
        'Enter a valid IANA timezone, such as Europe/Stockholm.',
      ),
    ).toBeInTheDocument();
    expect(configWrites).toHaveLength(0);
  });

  it('rejects concurrency settings outside the live server bounds', async () => {
    const user = new TestUserEvent();
    await page();
    await user.click(screen.getByRole('tab', { name: 'Settings' }));
    const maximum = await screen.findByLabelText('Maximum concurrent jobs');
    await user.clear(maximum);
    await user.type(maximum, '101');
    await user.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(
      await screen.findByText(
        'This server accepts between 0 and 100 concurrent jobs.',
      ),
    ).toBeInTheDocument();
    expect(configWrites).toHaveLength(0);
  });

  it('prevents installing in the wrong scheduler database', async () => {
    installed = false;
    state = { ...cronStateFixture, schedulerDatabase: 'another-database' };
    await page();
    expect(
      screen.getByRole('button', { name: 'Enable pg_cron' }),
    ).toBeDisabled();
    expect(
      screen.getByText('Different scheduler database'),
    ).toBeInTheDocument();
  });

  it('saves supported settings via project configuration, not session-only SQL', async () => {
    const user = new TestUserEvent();
    await page();
    await user.click(screen.getByRole('tab', { name: 'Settings' }));
    const timezone = await screen.findByLabelText('Timezone');
    await user.clear(timezone);
    await user.type(timezone, 'Europe/Stockholm');
    await user.click(screen.getByRole('button', { name: 'Save settings' }));
    await waitFor(() => expect(configWrites).toHaveLength(1));
    expect(configWrites[0]).toMatchObject({
      appId: 'project-id',
      timezone: 'Europe/Stockholm',
      maxRunningJobs: 32,
      logRun: 'on',
    });
    expect(writes).toHaveLength(0);
    expect(
      screen.getByText(/Run nhost up to restart Postgres/),
    ).toBeInTheDocument();
  });
});

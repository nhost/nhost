import { EditorView } from '@uiw/react-codemirror';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { toast } from 'react-hot-toast';
import SqlJobForm from '@/features/orgs/projects/events/sql-jobs/components/SqlJobForm';
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
  act,
  fireEvent,
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
let preloaded = true;
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
          {
            result_type: 'TuplesOk',
            result: [['trim'], [preloaded ? 'pg_cron' : '']],
          },
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
  Object.defineProperties(Range.prototype, {
    getClientRects: { configurable: true, value: () => [] },
    getBoundingClientRect: { configurable: true, value: () => new DOMRect() },
  });
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
  preloaded = true;
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

function sqlEditor() {
  const content = screen.getByRole('textbox', { name: 'SQL command' });
  const editor = EditorView.findFromDOM(content);
  if (!editor) {
    throw new Error('The SQL editor is not mounted.');
  }
  return editor;
}

function setSqlCommand(command: string) {
  const editor = sqlEditor();
  act(() => {
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: command },
    });
  });
}

async function createJob(user: TestUserEvent) {
  await page();
  await user.click(
    await screen.findByRole('button', { name: 'Create SQL job' }),
  );
  const dialog = within(await screen.findByRole('dialog'));
  await user.type(dialog.getByLabelText('Job name'), 'nightly-cleanup');
  setSqlCommand('SELECT 1;\nSELECT 2;');
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
    expect(
      sheet.queryByText('Database', { exact: true }),
    ).not.toBeInTheDocument();
    expect(
      sheet.queryByText('Connection', { exact: true }),
    ).not.toBeInTheDocument();
    expect(sheet.queryByText('localhost:5432')).not.toBeInTheDocument();
    const schedule = sheet.getByLabelText('Schedule');
    expect(schedule).toHaveValue(sqlJobFixture.schedule);
    expect(schedule).toHaveAttribute('readonly');
    expect(
      sheet.queryByRole('button', { name: 'Daily at 05:00' }),
    ).not.toBeInTheDocument();
    expect(sheet.getByRole('textbox', { name: 'SQL command' })).toHaveAttribute(
      'contenteditable',
      'false',
    );
    expect(sqlEditor().state.doc.toString()).toBe(sqlJobFixture.command);
    await user.click(schedule);
    await user.keyboard('{Home}');
    expect(sheet.getByText('Minute')).toHaveAttribute('aria-current', 'true');
    await user.type(schedule, '*/5 * * * *');
    expect(schedule).toHaveValue(sqlJobFixture.schedule);
    expect(writes).toHaveLength(0);
    await user.click(sheet.getByRole('button', { name: 'Close' }));
    await user.click(
      screen.getByRole('radio', { name: 'Disabled', hidden: false }),
    );
    expect(
      await screen.findByText('No jobs match your search or filter.'),
    ).toBeInTheDocument();
  });

  it('uses a real SQL editor without execution controls and validates its contents', async () => {
    const user = new TestUserEvent();
    await page();
    await user.click(
      await screen.findByRole('button', { name: 'Create SQL job' }),
    );
    const dialog = within(await screen.findByRole('dialog'));
    const editor = dialog.getByRole('textbox', { name: 'SQL command' });
    expect(editor).toHaveAttribute('contenteditable', 'true');
    expect(
      dialog.queryByRole('button', { name: 'Run' }),
    ).not.toBeInTheDocument();
    await user.type(dialog.getByLabelText('Job name'), 'editor-test');
    setSqlCommand('SELECT 1;');
    await user.click(editor);
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(writes).toHaveLength(0);
    setSqlCommand('   ');
    await user.click(dialog.getByRole('button', { name: 'Create job' }));
    expect(await dialog.findByText('SQL is required.')).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it('allows Tab to leave the SQL editor', async () => {
    const user = new TestUserEvent();
    await page();
    await user.click(
      await screen.findByRole('button', { name: 'Create SQL job' }),
    );
    const dialog = within(await screen.findByRole('dialog'));
    await user.click(dialog.getByRole('textbox', { name: 'SQL command' }));
    await user.keyboard('{Tab}');
    expect(dialog.getByLabelText('Database role')).toHaveFocus();
  });

  it('highlights cron fields as the cursor moves by keyboard and selection', async () => {
    const user = new TestUserEvent();
    await page();
    await user.click(
      await screen.findByRole('button', { name: 'Create SQL job' }),
    );
    const dialog = within(await screen.findByRole('dialog'));
    const schedule = dialog.getByLabelText('Schedule');
    await user.clear(schedule);
    await user.type(schedule, '0 22 * * 1-5');
    expect(dialog.getByText('Weekday')).toHaveAttribute('aria-current', 'true');
    await user.keyboard('{Home}');
    expect(dialog.getByText('Minute')).toHaveAttribute('aria-current', 'true');
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(dialog.getByText('Hour')).toHaveAttribute('aria-current', 'true');
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}');
    expect(dialog.getByText('Day')).toHaveAttribute('aria-current', 'true');
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(dialog.getByText('Month')).toHaveAttribute('aria-current', 'true');
    fireEvent.select(schedule, {
      target: { selectionStart: 9, selectionEnd: 9 },
    });
    expect(dialog.getByText('Weekday')).toHaveAttribute('aria-current', 'true');
    await user.click(dialog.getByLabelText('Job name'));
    expect(dialog.getByText('Weekday')).not.toHaveAttribute('aria-current');
  });

  it('explains cron operators and supported shortcuts without dismissing the job modal', async () => {
    const user = new TestUserEvent();
    await page();
    await user.click(
      await screen.findByRole('button', { name: 'Create SQL job' }),
    );
    const dialog = within(await screen.findByRole('dialog'));
    await user.click(
      dialog.getByRole('button', { name: 'Cron schedule help' }),
    );
    const help = within(
      await screen.findByRole('dialog', { name: 'Cron schedule help' }),
    );
    expect(
      help.getByRole('heading', { name: 'Cron syntax' }),
    ).toBeInTheDocument();
    expect(help.getByText('*/15')).toBeInTheDocument();
    expect(help.getByText('$')).toBeInTheDocument();
    expect(help.getByText('@hourly')).toBeInTheDocument();
    expect(help.getByText('@daily')).toBeInTheDocument();
    expect(help.getByText('@annually')).toBeInTheDocument();
    expect(help.getByText('@reboot')).toBeInTheDocument();
    expect(help.getByText('@restart')).toBeInTheDocument();
    expect(help.getByText('59 seconds')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Cron schedule help' }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole('dialog', { name: 'Create SQL job' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it('fills the schedule from examples without creating a job', async () => {
    const user = new TestUserEvent();
    await page();
    await user.click(
      await screen.findByRole('button', { name: 'Create SQL job' }),
    );
    const dialog = within(await screen.findByRole('dialog'));
    await user.click(dialog.getByRole('button', { name: 'Daily at 05:00' }));
    expect(dialog.getByLabelText('Schedule')).toHaveValue('0 5 * * *');
    await user.click(dialog.getByRole('button', { name: 'Weekdays at 22:00' }));
    expect(dialog.getByLabelText('Schedule')).toHaveValue('0 22 * * 1-5');
    await user.click(dialog.getByRole('button', { name: 'Every 10 seconds' }));
    expect(dialog.getByLabelText('Schedule')).toHaveValue('10 seconds');
    expect(dialog.getByText('Minute')).not.toHaveAttribute('aria-current');
    expect(
      dialog.getByText(
        'This seconds-based interval replaces all five cron fields.',
      ),
    ).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it.each([
    '@daily',
    '@reboot',
    '@restart',
    '1 second',
    '10 seconds',
    '0 0 $ * *',
  ])('preserves the pg_cron schedule %s when saving', async (schedule) => {
    const user = new TestUserEvent();
    await page();
    await user.click(
      await screen.findByRole('button', { name: 'Create SQL job' }),
    );
    const dialog = within(await screen.findByRole('dialog'));
    await user.type(dialog.getByLabelText('Job name'), 'schedule-example');
    await user.clear(dialog.getByLabelText('Schedule'));
    await user.type(dialog.getByLabelText('Schedule'), schedule);
    if (schedule.startsWith('@') || schedule.includes('second')) {
      expect(dialog.getByText('Minute')).not.toHaveAttribute('aria-current');
      expect(dialog.getByText('Hour')).not.toHaveAttribute('aria-current');
    }
    setSqlCommand('SELECT 1;');
    await user.click(dialog.getByRole('button', { name: 'Create job' }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(JSON.stringify(writes[0].body)).toContain(schedule);
  });

  it('always creates jobs in the supplied database, even when a preset specifies another', async () => {
    const user = new TestUserEvent();
    render(
      <SqlJobForm
        database="supplied-database"
        timezone="GMT"
        initialValues={{
          jobname: 'supplied-database-job',
          command: 'SELECT 1;',
          database: 'preset-database',
        }}
        onClose={vi.fn()}
      />,
    );
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.queryByLabelText('Database')).not.toBeInTheDocument();
    await user.click(dialog.getByRole('button', { name: 'Create job' }));
    await waitFor(() => expect(writes).toHaveLength(1));
    const body = JSON.stringify(writes[0].body);
    expect(body).toContain('current_database()');
    expect(body).not.toContain("'supplied-database'");
    expect(body).not.toContain('preset-database');
  });

  it('preserves an existing job database when editing without a database input', async () => {
    const user = new TestUserEvent();
    render(
      <SqlJobForm
        job={{ ...sqlJobFixture, database: 'existing-database' }}
        database="supplied-database"
        timezone="GMT"
        onClose={vi.fn()}
      />,
    );
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.queryByLabelText('Database')).not.toBeInTheDocument();
    await user.click(dialog.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(writes).toHaveLength(1));
    const body = JSON.stringify(writes[0].body);
    expect(body).toContain('existing-database');
    expect(body).not.toContain('supplied-database');
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

  it.each([true, false])(
    'uses labeled icon actions and toggles the job through a migration (active=%s)',
    async (active) => {
      const user = new TestUserEvent();
      jobs[0].active = active;
      await page();
      const toggleAction = active ? 'Disable' : 'Enable';
      await screen.findByRole('button', {
        name: `${toggleAction} refresh-summary`,
      });
      for (const action of [toggleAction, 'Edit', 'Delete']) {
        const button = screen.getByRole('button', {
          name: `${action} refresh-summary`,
        });
        expect(button).toHaveAttribute('title', `${action} job`);
        expect(button.textContent).toBe('');
        expect(button.querySelector('svg')).toHaveAttribute(
          'aria-hidden',
          'true',
        );
      }
      await user.click(
        screen.getByRole('button', {
          name: `${toggleAction} refresh-summary`,
        }),
      );
      await waitFor(() => expect(writes).toHaveLength(1));
      expect(writes[0].body).toMatchObject({
        up: [{ args: { sql: expect.stringContaining('cron.alter_job') } }],
      });
    },
  );

  it.each([
    {
      opener: 'Delete refresh-summary',
      submit: 'Delete job',
      nextOpener: 'Disable pg_cron',
    },
    {
      opener: 'Disable pg_cron',
      submit: 'Disable pg_cron',
      nextOpener: 'Delete refresh-summary',
    },
  ])(
    'clears previous action errors before confirming $submit',
    async ({ opener, submit, nextOpener }) => {
      let attempts = 0;
      server.use(
        http.post(`${HASURA_URL}/apis/migrate`, () => {
          attempts += 1;
          return HttpResponse.json(
            { error: attempts === 1 ? 'Toggle failed' : 'Confirmation failed' },
            { status: 400 },
          );
        }),
      );
      const user = new TestUserEvent();
      await page();
      const toggle = await screen.findByRole('button', {
        name: 'Disable refresh-summary',
      });
      await user.click(toggle);
      await waitFor(() => expect(attempts).toBe(1));
      await waitFor(() => expect(toggle).toBeEnabled());

      await user.click(screen.getByRole('button', { name: opener }));
      const dialog = within(await screen.findByRole('alertdialog'));
      expect(dialog.queryByRole('alert')).not.toBeInTheDocument();
      expect(dialog.queryByText('Toggle failed')).not.toBeInTheDocument();
      expect(attempts).toBe(1);

      await user.click(dialog.getByRole('button', { name: submit }));
      expect(
        await dialog.findByText('Confirmation failed'),
      ).toBeInTheDocument();
      expect(attempts).toBe(2);
      await waitFor(() =>
        expect(dialog.getByRole('button', { name: 'Cancel' })).toBeEnabled(),
      );
      await user.click(dialog.getByRole('button', { name: 'Cancel' }));
      await waitFor(() =>
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
      );

      await user.click(screen.getByRole('button', { name: nextOpener }));
      const nextDialog = within(await screen.findByRole('alertdialog'));
      expect(nextDialog.queryByRole('alert')).not.toBeInTheDocument();
      expect(
        nextDialog.queryByText('Confirmation failed'),
      ).not.toBeInTheDocument();
      expect(attempts).toBe(2);
    },
  );

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
    expect(sqlEditor().state.doc.toString()).toBe(sqlJobFixture.command);
  });

  it('keeps editable scheduler settings without the raw live-settings section', async () => {
    const user = new TestUserEvent();
    await page();
    await user.click(screen.getByRole('tab', { name: 'Settings' }));

    expect(await screen.findByLabelText('Timezone')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Maximum concurrent jobs'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('switch', { name: 'Record job runs' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Live Postgres settings' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it.each([false, true])(
    'previews and creates a daily 05:00 retention job (platform: %s)',
    async (platform) => {
      mocks.platform.mockReturnValue(platform);
      state = {
        ...cronStateFixture,
        database: 'retention-db',
        schedulerDatabase: 'retention-db',
      };
      const user = new TestUserEvent();
      await page();
      await user.click(screen.getByRole('tab', { name: 'Settings' }));
      await user.click(
        await screen.findByRole('button', { name: 'Create retention job' }),
      );
      const dialog = within(await screen.findByRole('dialog'));

      expect(
        dialog.getByRole('heading', { name: 'Create SQL job' }),
      ).toBeInTheDocument();
      expect(dialog.getByLabelText('Job name')).toHaveValue(
        'cleanup-cron-run-history',
      );
      expect(dialog.getByLabelText('Job name')).toBeEnabled();
      expect(dialog.getByLabelText('Schedule')).toHaveValue('0 5 * * *');
      expect(sqlEditor().state.doc.toString()).toBe(
        "DELETE FROM cron.job_run_details\nWHERE end_time < now() - interval '7 days';",
      );
      expect(dialog.queryByLabelText('Database')).not.toBeInTheDocument();
      expect(dialog.getByLabelText('Database role')).toHaveValue('postgres');
      expect(dialog.getByRole('switch', { name: 'Enabled' })).toBeChecked();
      expect(writes).toHaveLength(0);
      expect(configWrites).toHaveLength(0);

      await user.click(dialog.getByRole('button', { name: 'Create job' }));
      await waitFor(() => expect(writes).toHaveLength(1));
      expect(writes[0].url).toBe(
        `${HASURA_URL}/${platform ? 'v2/query' : 'apis/migrate'}`,
      );
      const body = JSON.stringify(writes[0].body);
      expect(body).toContain('cleanup-cron-run-history');
      expect(body).toContain('current_database()');
      expect(body).not.toContain("'retention-db'");
      expect(body).toContain('0 5 * * *');
      expect(body).toContain('DELETE FROM cron.job_run_details');
      expect(body).toContain('7 days');
      expect(configWrites).toHaveLength(0);
    },
  );

  it('does not persist a cancelled retention preset or reuse it for ordinary jobs', async () => {
    const user = new TestUserEvent();
    await page();
    await user.click(screen.getByRole('tab', { name: 'Settings' }));
    await user.click(
      await screen.findByRole('button', { name: 'Create retention job' }),
    );
    const dialog = within(await screen.findByRole('dialog'));
    await user.click(dialog.getByRole('button', { name: 'Cancel' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(writes).toHaveLength(0);
    expect(configWrites).toHaveLength(0);

    await user.click(screen.getByRole('tab', { name: 'Jobs' }));
    await user.click(
      await screen.findByRole('button', { name: 'Create SQL job' }),
    );
    const ordinaryDialog = within(await screen.findByRole('dialog'));
    expect(ordinaryDialog.getByLabelText('Job name')).toHaveValue('');
    expect(sqlEditor().state.doc.toString()).toBe('');
    expect(ordinaryDialog.getByLabelText('Schedule')).toHaveValue('0 * * * *');
  });

  it.each(['not installed', 'not preloaded', 'in another database'])(
    'disables retention-job creation when pg_cron is %s',
    async (condition) => {
      installed = condition !== 'not installed';
      preloaded = condition !== 'not preloaded';
      if (condition === 'in another database') {
        state = { ...cronStateFixture, schedulerDatabase: 'another-database' };
      }
      const user = new TestUserEvent();
      await page();
      await user.click(screen.getByRole('tab', { name: 'Settings' }));
      expect(
        await screen.findByRole('button', { name: 'Create retention job' }),
      ).toBeDisabled();
      expect(writes).toHaveLength(0);
    },
  );

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

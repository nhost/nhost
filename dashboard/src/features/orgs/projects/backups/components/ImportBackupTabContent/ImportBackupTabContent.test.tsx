import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import { Tabs } from '@/components/ui/v3/tabs';
import {
  fetchPiTRBaseBackups,
  mockApplication,
  mockMatchMediaValue,
} from '@/tests/mocks';
import {
  getApplicationBackups,
  MOCK_BACKUP_ID,
} from '@/tests/msw/mocks/graphql/getApplicationBackups';
import {
  getBackupPresignedUrl,
  getBackupPresignedUrlRequest,
} from '@/tests/msw/mocks/graphql/getBackupPresignedUrl';
import { getOrganization } from '@/tests/msw/mocks/graphql/getOrganizationQuery';
import {
  getPiTRNotEnabledPostgresSettings,
  getPostgresSettings,
} from '@/tests/msw/mocks/graphql/getPostgresSettings';
import { getProjectQuery } from '@/tests/msw/mocks/graphql/getProjectQuery';
import {
  getEmptyProjectsQuery,
  getProjectsQuery,
} from '@/tests/msw/mocks/graphql/getProjectsQuery';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import {
  restoreApplicationDatabase,
  restoreApplicationDatabaseRequest,
} from '@/tests/msw/mocks/graphql/restoreApplicationDatabase';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import {
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import ImportBackupContent from './ImportBackupTabContent';

function TestComponent() {
  return (
    <Tabs value="importBackup">
      <ImportBackupContent />
    </Tabs>
  );
}

mockPointerEvent();

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

const server = setupServer(tokenQuery, getProjectQuery);

const mocks = vi.hoisted(() => ({
  useGetPiTrBaseBackupsLazyQuery: vi.fn(),
  fetchPiTRBaseBackups: vi.fn(),
  restoreApplicationDatabase: vi.fn(),
}));

vi.mock('@/utils/__generated__/graphql', async () => {
  // biome-ignore lint/suspicious/noExplicitAny: test file
  const actual = await vi.importActual<any>('@/utils/__generated__/graphql');
  return {
    ...actual,
    useGetPiTrBaseBackupsLazyQuery: mocks.useGetPiTrBaseBackupsLazyQuery,
  };
});

vi.mock('@/utils/timezoneUtils', async () => {
  // biome-ignore lint/suspicious/noExplicitAny: test file
  const actualTimezoneUtils = await vi.importActual<any>(
    '@/utils/timezoneUtils',
  );
  return {
    ...actualTimezoneUtils,
    guessTimezone: () => 'Europe/Helsinki',
  };
});

vi.mock('@/features/orgs/hooks/useRestoreApplicationDatabasePiTR', () => ({
  useRestoreApplicationDatabasePiTR: () => ({
    restoreApplicationDatabase: mocks.restoreApplicationDatabase,
    loading: false,
  }),
}));

describe('ImportBackupContent', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
    process.env.NEXT_PUBLIC_ENV = 'production';
    server.listen();
  });

  afterEach(() => {
    server.resetHandlers();
    getBackupPresignedUrlRequest.variables = undefined;
    restoreApplicationDatabaseRequest.variables = undefined;
  });

  afterAll(() => {
    server.close();
    vi.restoreAllMocks();
  });

  test("will display the target project's name and a select with the projects from the same region", async () => {
    const user = new TestUserEvent();
    server.use(getOrganization);
    server.use(getProjectsQuery);

    render(<TestComponent />);
    await waitFor(async () =>
      expect(
        screen.getByText(
          `${mockApplication.name} (${mockApplication.region.name})`,
        ),
      ).toBeInTheDocument(),
    );

    const projectComboBox = await screen.findByRole('combobox');

    await user.click(projectComboBox);
    // check for only projects from the same region are listed
    expect(screen.getByRole('option', { name: /pitr14/i })).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: /pitr-not-enabled/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: /pitr-test/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: /pitr-region-test-eu/i }),
    ).not.toBeInTheDocument();
  });

  test('warning is displayed if there is no other project in the same organization', async () => {
    server.use(getOrganization);
    server.use(getEmptyProjectsQuery);

    render(<TestComponent />);

    await waitFor(async () =>
      expect(
        screen.getByText(/There are no other projects within the region:/i),
      ).toBeInTheDocument(),
    );
  });

  test('will schedule an import from the selected project', async () => {
    const user = new TestUserEvent();
    server.use(getOrganization);
    server.use(getProjectsQuery);
    server.use(getPostgresSettings);
    mocks.useGetPiTrBaseBackupsLazyQuery.mockImplementation(() => [
      fetchPiTRBaseBackups,
      { loading: false },
    ]);

    render(<TestComponent />);
    expect(
      screen.getByText(
        `${mockApplication.name} (${mockApplication.region.name})`,
      ),
    ).toBeInTheDocument();

    const projectComboBox = await screen.findByRole('combobox');

    await user.click(projectComboBox);

    await waitFor(async () => {
      await user.click(
        screen.getByRole('option', {
          name: 'pitr14 (us-east-1)',
        }),
      );
    });

    expect(
      screen.getByText('Import backup from pitr14 (us-east-1)'),
    ).toBeInTheDocument();

    const startImportButton = screen.getByRole('button', {
      name: 'Start import',
    });
    await user.click(startImportButton);

    await waitFor(async () =>
      expect(
        screen.getByRole('button', { name: 'Import backup' }),
      ).toBeInTheDocument(),
    );

    const dateTimePickerButton = screen.getByRole('button', {
      name: /UTC/i,
    });

    await user.click(dateTimePickerButton);

    await waitFor(async () =>
      expect(
        screen.getByRole('button', { name: 'Select' }),
      ).toBeInTheDocument(),
    );

    await user.click(screen.getByText('13'));

    const hoursInput = screen.getByLabelText('Hours');
    await waitFor(async () => {
      await user.type(hoursInput, '18');
    });
    const updatedDateTimeButton = screen.getByRole('button', {
      name: /UTC/i,
    });

    expect(updatedDateTimeButton).toHaveTextContent(
      '10 Mar 2025, 05:00:05 (UTC+02:00)',
    );

    await user.click(screen.getByRole('button', { name: 'Select' }));

    await waitFor(async () =>
      expect(
        screen.queryByRole('button', { name: 'Select' }),
      ).not.toBeInTheDocument(),
    );

    expect(updatedDateTimeButton).toHaveTextContent(
      '13 Mar 2025, 18:00:05 (UTC+02:00)',
    );

    // check checkboxes

    await user.click(
      screen.getByLabelText(/I understand that restoring this backup/),
    );

    await user.click(
      screen.getByLabelText(/I understand this cannot be undone/),
    );

    await waitFor(async () =>
      expect(
        screen.getByRole('button', { name: 'Import backup' }),
      ).not.toBeDisabled(),
    );

    await user.click(screen.getByRole('button', { name: 'Import backup' }));

    expect(mocks.restoreApplicationDatabase.mock.calls[0][0].fromAppId).toBe(
      'pitr14-id',
    );

    expect(
      mocks.restoreApplicationDatabase.mock.calls[0][0].recoveryTarget,
    ).toBe('2025-03-13T16:00:05.000Z');
  });

  test('imports a logical backup from a project without PiTR', async () => {
    const user = new TestUserEvent();
    const openWindow = vi.spyOn(window, 'open').mockImplementation(() => null);
    server.use(getOrganization);
    server.use(getProjectsQuery);
    server.use(getPiTRNotEnabledPostgresSettings);
    server.use(getApplicationBackups);
    server.use(getBackupPresignedUrl);
    server.use(restoreApplicationDatabase);

    render(<TestComponent />);

    const projectComboBox = await screen.findByRole('combobox');
    await user.click(projectComboBox);
    await user.click(
      screen.getByRole('option', {
        name: 'pitr-not-enabled-usa (us-east-1)',
      }),
    );

    expect(
      await screen.findByText(
        'Import backup from pitr-not-enabled-usa (us-east-1)',
      ),
    ).toBeInTheDocument();
    expect(await screen.findByText('2026-07-20 15:00:00')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Start import' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Download' }));
    await waitFor(() =>
      expect(getBackupPresignedUrlRequest.variables).toEqual({
        appId: 'pitr-usa-id',
        backupId: MOCK_BACKUP_ID,
      }),
    );
    expect(openWindow).toHaveBeenCalledWith(
      'https://example.com/backup',
      '_blank',
    );

    await user.click(screen.getByRole('button', { name: 'Restore' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Test Project');
    expect(dialog).toHaveTextContent('pitr-not-enabled-usa (us-east-1)');

    await user.click(
      screen.getByLabelText("I'm sure I want to restore this backup"),
    );
    await user.click(screen.getByRole('button', { name: 'Import backup' }));

    await waitFor(() =>
      expect(restoreApplicationDatabaseRequest.variables).toEqual({
        backupId: MOCK_BACKUP_ID,
        appId: mockApplication.id,
        fromAppId: 'pitr-usa-id',
      }),
    );
  });

  test.each([
    ['an empty backup list', { app: { id: 'pitr-usa-id', backups: [] } }],
    ['a null source app', { app: null }],
    ['an undefined source app', {}],
  ])('shows the empty state for %s', async (_case, data) => {
    const user = new TestUserEvent();
    server.use(getOrganization);
    server.use(getProjectsQuery);
    server.use(getPiTRNotEnabledPostgresSettings);
    server.use(
      nhostGraphQLLink.query('getApplicationBackups', () =>
        HttpResponse.json({ data }),
      ),
    );

    render(<TestComponent />);

    const projectComboBox = await screen.findByRole('combobox');
    await user.click(projectComboBox);
    await user.click(
      screen.getByRole('option', {
        name: 'pitr-not-enabled-usa (us-east-1)',
      }),
    );

    expect(
      await screen.findByText(
        'Import backup from pitr-not-enabled-usa (us-east-1)',
      ),
    ).toBeInTheDocument();
    expect(await screen.findByText('No backups are available.')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Restore' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Import backup' }),
    ).not.toBeInTheDocument();
  });
});

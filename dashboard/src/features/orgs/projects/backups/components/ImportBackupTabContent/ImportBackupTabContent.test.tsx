import {
  fetchPiTRBaseBackups,
  mockApplication,
  mockMatchMediaValue,
} from '@/tests/mocks';
import {
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import { setupServer } from 'msw/node';
import { vi } from 'vitest';

import { Tabs } from '@/components/ui/v3/tabs';
import { getOrganization } from '@/tests/msw/mocks/graphql/getOrganizationQuery';
import {
  getPiTRNotEnabledPostgresSettings,
  getPostgresSettings,
} from '@/tests/msw/mocks/graphql/getPostgresSettings';
import {
  getEmptyProjectsQuery,
  getProjectsQuery,
} from '@/tests/msw/mocks/graphql/getProjectsQuery';
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

const server = setupServer();

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

vi.mock('@/features/orgs/projects/hooks/useProject', async () => ({
  useProject: () => ({ project: mockApplication }),
}));

describe('ImportBackupContent', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
    process.env.NEXT_PUBLIC_ENV = 'production';
    server.listen();
  });

  afterEach(() => {
    server.resetHandlers();
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
    expect(
      screen.getByText(
        `${mockApplication.name} (${mockApplication.region.name})`,
      ),
    ).toBeInTheDocument();

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

  test('that warning is displayed if there is no other project in the same organization', async () => {
    server.use(getOrganization);
    server.use(getEmptyProjectsQuery);

    render(<TestComponent />);

    expect(
      await screen.findByText(
        /There are no other projects within the region:/i,
      ),
    ).toBeInTheDocument();
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
      '13 Mar 2025, 18:00:05 (UTC+02:00)',
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

  test('Pitr is not enabled on project', async () => {
    const user = new TestUserEvent();
    server.use(getOrganization);
    server.use(getProjectsQuery);
    server.use(getPiTRNotEnabledPostgresSettings);

    render(<TestComponent />);

    const projectComboBox = await screen.findByRole('combobox');

    await user.click(projectComboBox);

    await user.click(
      screen.getByRole('option', {
        name: 'pitr-not-enabled-usa (us-east-1)',
      }),
    );

    expect(
      screen.getByText(
        'Point-in-Time Recovery is not enabled on the selected project',
      ),
    ).toBeInTheDocument();
  });
});

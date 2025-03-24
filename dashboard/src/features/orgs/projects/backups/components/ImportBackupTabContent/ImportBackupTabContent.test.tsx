import {
  fetchPiTRBaseBackups,
  mockApplication,
  mockMatchMediaValue,
} from '@/tests/mocks';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import {
  mockPointerEvent,
  render,
  screen,
  waitFor,
} from '@/tests/orgs/testUtils';
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
import userEvent from '@testing-library/user-event';
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

const server = setupServer(tokenQuery);

const mocks = vi.hoisted(() => ({
  useGetPiTrBaseBackupsLazyQuery: vi.fn(),
  fetchPiTRBaseBackups: vi.fn(),
  restoreApplicationDatabase: vi.fn(),
}));

vi.mock('@/utils/__generated__/graphql', async () => {
  const actual = await vi.importActual<any>('@/utils/__generated__/graphql');
  return {
    ...actual,
    useGetPiTrBaseBackupsLazyQuery: mocks.useGetPiTrBaseBackupsLazyQuery,
  };
});

vi.mock('@/utils/timezoneUtils', async () => {
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

  afterAll(() => {
    server.close();
    vi.restoreAllMocks();
  });

  test("will display the target project's name and a select with the projects from the same region", async () => {
    server.use(getOrganization);
    server.use(getProjectsQuery);

    const user = userEvent.setup();

    render(<TestComponent />);
    expect(
      await screen.getByText(
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

  test('that warning is displayed if there are no other projects in the same organization', async () => {
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
    server.use(getOrganization);
    server.use(getProjectsQuery);
    server.use(getPostgresSettings);
    mocks.useGetPiTrBaseBackupsLazyQuery.mockImplementation(() => [
      fetchPiTRBaseBackups,
      { loading: false },
    ]);

    const user = userEvent.setup();

    render(<TestComponent />);
    expect(
      await screen.getByText(
        `${mockApplication.name} (${mockApplication.region.name})`,
      ),
    ).toBeInTheDocument();

    const projectComboBox = await screen.findByRole('combobox');

    await user.click(projectComboBox);

    await user.click(
      screen.getByRole('option', {
        name: 'pitr14 (us-east-1)',
      }),
    );

    expect(
      await screen.getByText('Import backup from pitr14 (us-east-1)'),
    ).toBeInTheDocument();

    const startImportButton = await screen.getByRole('button', {
      name: 'Start import',
    });

    await user.click(startImportButton);

    await waitFor(async () =>
      expect(
        await screen.getByRole('button', { name: 'Import backup' }),
      ).toBeInTheDocument(),
    );

    const dateTimePickerButton = await screen.getByRole('button', {
      name: /UTC/i,
    });

    await user.click(dateTimePickerButton);

    await waitFor(async () =>
      expect(
        await screen.getByRole('button', { name: 'Select' }),
      ).toBeInTheDocument(),
    );

    await user.click(await screen.getByText('13'));

    const hoursInput = await screen.getByLabelText('Hours');
    await user.type(hoursInput, '18');

    const updatedDateTimeButton = await screen.getByRole('button', {
      name: /UTC/i,
    });
    expect(updatedDateTimeButton).toHaveTextContent(
      '13 Mar 2025, 18:00:05 (UTC+02:00)',
    );
    await user.click(await screen.getByRole('button', { name: 'Select' }));

    await waitFor(async () =>
      expect(
        await screen.queryByRole('button', { name: 'Select' }),
      ).not.toBeInTheDocument(),
    );

    expect(updatedDateTimeButton).toHaveTextContent(
      '13 Mar 2025, 18:00:05 (UTC+02:00)',
    );

    // check checkboxes

    await user.click(
      await screen.getByLabelText(/I understand that restoring this backup/),
    );

    await user.click(
      await screen.getByLabelText(/I understand this cannot be undone/),
    );

    await waitFor(async () =>
      expect(
        await screen.getByRole('button', { name: 'Import backup' }),
      ).not.toBeDisabled(),
    );

    await user.click(
      await screen.getByRole('button', { name: 'Import backup' }),
    );

    expect(mocks.restoreApplicationDatabase.mock.calls[0][0].fromAppId).toBe(
      'pitr14-id',
    );

    expect(
      mocks.restoreApplicationDatabase.mock.calls[0][0].recoveryTarget,
    ).toBe('2025-03-13T16:00:05.000Z');
  });
  // TODO
  test('Pitr is not enabled on project', async () => {
    server.use(getOrganization);
    server.use(getProjectsQuery);
    server.use(getPiTRNotEnabledPostgresSettings);

    const user = userEvent.setup();

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

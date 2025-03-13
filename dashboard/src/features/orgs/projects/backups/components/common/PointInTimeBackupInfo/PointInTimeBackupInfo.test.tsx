import {
  fetchEmptyPiTRBaseBackups,
  fetchPiTRBaseBackups,
  mockApplication,
  mockMatchMediaValue,
} from '@/tests/mocks';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import { render, screen, waitFor } from '@/tests/orgs/testUtils';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { vi } from 'vitest';

import { getOrganization } from '@/tests/msw/mocks/graphql/getOrganizationQuery';
import { getProjectQuery } from '@/tests/msw/mocks/graphql/getProjectQuery';

import PointInTimeBackupInfo from './PointInTimeBackupInfo';

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

describe('PointInTimeBackupInfo', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
    process.env.NEXT_PUBLIC_ENV = 'production';
    server.listen();
  });

  afterAll(() => {
    server.close();
    vi.restoreAllMocks();
  });

  test('will fetch the earliest backup and will display the date in with timezone', async () => {
    server.use(getOrganization);
    server.use(getProjectQuery);
    mocks.useGetPiTrBaseBackupsLazyQuery.mockImplementation(() => [
      fetchPiTRBaseBackups,
      { loading: false },
    ]);

    await waitFor(() => render(<PointInTimeBackupInfo appId="randomId" />));
    // '10 March 2025, 05:00:05 (UTC+02:00)'
    const earliestBackup = await screen.getByTestId('EarliestBackupDateTime');
    expect(earliestBackup).toHaveTextContent(
      '10 Mar 2025, 05:00:05 (UTC+02:00)',
    );
  });

  test('will update the date after the timezone is changed', async () => {
    server.use(getOrganization);
    server.use(getProjectQuery);
    mocks.useGetPiTrBaseBackupsLazyQuery.mockImplementation(() => [
      fetchPiTRBaseBackups,
      { loading: false },
    ]);
    await waitFor(() => render(<PointInTimeBackupInfo appId="randomId" />));
    const user = userEvent.setup();
    // '10 March 2025, 05:00:05 (UTC+02:00)'
    const earliestBackup = await screen.getByTestId('EarliestBackupDateTime');
    expect(earliestBackup).toHaveTextContent(
      '10 Mar 2025, 05:00:05 (UTC+02:00)',
    );

    const changeTimezoneButton = await screen.getByRole('button', {
      name: 'Change timezone',
    });
    await user.click(changeTimezoneButton);
    const tzInput = await screen.getByPlaceholderText('Search timezones...');
    expect(tzInput).toBeInTheDocument();
    await user.type(tzInput, 'Asia/Amman{ArrowDown}{Enter}');
    await waitFor(() => expect(tzInput).not.toBeInTheDocument());
    const updatedEarliestBackup = await screen.getByTestId(
      'EarliestBackupDateTime',
    );
    expect(updatedEarliestBackup).toHaveTextContent(
      '10 Mar 2025, 06:00:05 (UTC+03:00)',
    );
  });

  test('will fetch the earliest backup and display "Project has no backups yet." test if there are now backups and start restore is disabled', async () => {
    server.use(getOrganization);
    server.use(getProjectQuery);
    mocks.useGetPiTrBaseBackupsLazyQuery.mockImplementation(() => [
      fetchEmptyPiTRBaseBackups,
      { loading: false },
    ]);

    await waitFor(() => render(<PointInTimeBackupInfo appId="randomId" />));
    // '10 March 2025, 05:00:05 (UTC+02:00)'
    const earliestBackup = await screen.getByText(
      'Project has no backups yet.',
    );
    expect(earliestBackup).toBeInTheDocument();
    const startRestoreButton = await screen.getByRole('button', {
      name: 'Start restore',
    });
    expect(startRestoreButton).toBeDisabled();
  });

  test('will schedule a restore', async () => {
    server.use(getOrganization);
    server.use(getProjectQuery);
    mocks.useGetPiTrBaseBackupsLazyQuery.mockImplementation(() => [
      fetchPiTRBaseBackups,
      { loading: false },
    ]);

    await waitFor(() =>
      render(<PointInTimeBackupInfo appId={mockApplication.id} />),
    );
    const user = userEvent.setup();
    const startRestoreButton = await screen.getByRole('button', {
      name: 'Start restore',
    });

    await user.click(startRestoreButton);
    await waitFor(async () =>
      expect(
        await screen.getByText('Recover your database from a backup'),
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
    await user.click(
      await screen.getByRole('gridcell', {
        name: /13/i,
      }),
    );

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

    expect(
      await screen.getByRole('button', { name: 'Restore backup' }),
    ).toBeDisabled();
    // check checkboxes

    await user.click(
      await screen.getByLabelText(/I understand that restoring this backup/),
    );

    expect(
      await screen.getByLabelText(/I understand that restoring this backup/),
    ).toBeChecked();

    expect(
      await screen.getByRole('button', { name: 'Restore backup' }),
    ).toBeDisabled();

    await user.click(
      await screen.getByLabelText(/I understand this cannot be undone/),
    );

    expect(
      await screen.getByLabelText(/I understand this cannot be undone/),
    ).toBeChecked();

    await waitFor(async () =>
      expect(
        await screen.getByRole('button', { name: 'Restore backup' }),
      ).not.toBeDisabled(),
    );

    await user.click(
      await screen.getByRole('button', { name: 'Restore backup' }),
    );

    expect(
      mocks.restoreApplicationDatabase.mock.calls[0][0].fromAppId,
    ).toBeNull();

    expect(
      mocks.restoreApplicationDatabase.mock.calls[0][0].recoveryTarget,
    ).toBe('2025-03-13T16:00:05.000Z');
  });
});

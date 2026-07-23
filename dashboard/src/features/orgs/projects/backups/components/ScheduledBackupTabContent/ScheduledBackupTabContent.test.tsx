import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import { Tabs } from '@/components/ui/v3/tabs';
import { mockApplication, mockOrganization } from '@/tests/mocks';
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
  restoreApplicationDatabase,
  restoreApplicationDatabaseRequest,
} from '@/tests/msw/mocks/graphql/restoreApplicationDatabase';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import { render, screen, waitFor } from '@/tests/testUtils';
import ScheduledBackupTabContent from './ScheduledBackupTabContent';

function TestComponent() {
  return (
    <Tabs value="scheduledBackups">
      <ScheduledBackupTabContent />
    </Tabs>
  );
}

const server = setupServer(tokenQuery);

describe('ScheduledBackupTabContent', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
    process.env.NEXT_PUBLIC_ENV = 'production';
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
    server.listen();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
    vi.restoreAllMocks();
  });

  test('that Scheduled backups is loaded if PiTR is not enabled', async () => {
    server.use(
      getPiTRNotEnabledPostgresSettings,
      getProjectQuery,
      getApplicationBackups,
    );
    render(<TestComponent />);
    expect(
      await screen.findByText(/The database backup includes database schema/i),
    ).toBeInTheDocument();
    expect(await screen.findByText('1.02 KB')).toBeInTheDocument();
  });

  test('that a warning message is displayed if Point-in-Time Recovery is enabled ', async () => {
    server.use(getProjectQuery);
    server.use(getPostgresSettings);

    render(<TestComponent />);
    expect(
      await screen.findByText(/With Point-in-Time Recovery enabled/i),
    ).toBeInTheDocument();
  });

  test('restores a scheduled backup into the current project', async () => {
    const user = userEvent.setup();
    server.use(
      getPiTRNotEnabledPostgresSettings,
      getProjectQuery,
      getOrganization,
      getApplicationBackups,
      getBackupPresignedUrl,
      restoreApplicationDatabase,
    );

    render(<TestComponent />);
    await user.click(await screen.findByRole('button', { name: 'Restore' }));
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Restore' }));

    await waitFor(() =>
      expect(restoreApplicationDatabaseRequest.variables).toEqual({
        appId: mockApplication.id,
        fromAppId: null,
        backupId: MOCK_BACKUP_ID,
      }),
    );
    expect(
      await screen.findByText(
        'Your backup restore has been scheduled successfully and will start shortly.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Logs page' })).toHaveAttribute(
      'href',
      `/orgs/${mockOrganization.slug}/projects/${mockApplication.subdomain}/logs`,
    );
  });

  test('downloads a scheduled backup from the current project', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'open').mockImplementation(() => null);
    server.use(
      getPiTRNotEnabledPostgresSettings,
      getProjectQuery,
      getApplicationBackups,
      getBackupPresignedUrl,
    );

    render(<TestComponent />);
    await user.click(await screen.findByRole('button', { name: 'Download' }));

    await waitFor(() =>
      expect(getBackupPresignedUrlRequest.variables).toEqual({
        appId: mockApplication.id,
        backupId: MOCK_BACKUP_ID,
      }),
    );
  });
});

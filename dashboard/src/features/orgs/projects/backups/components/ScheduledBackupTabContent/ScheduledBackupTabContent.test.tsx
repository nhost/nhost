import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import { Tabs } from '@/components/ui/v3/tabs';
import {
  getPiTRNotEnabledPostgresSettings,
  getPostgresSettings,
} from '@/tests/msw/mocks/graphql/getPostgresSettings';
import { getProjectQuery } from '@/tests/msw/mocks/graphql/getProjectQuery';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import { render, screen } from '@/tests/testUtils';
import ScheduledBackupTabContent from './ScheduledBackupTabContent';

function TestComponent() {
  return (
    <Tabs value="scheduledBackups">
      <ScheduledBackupTabContent />
    </Tabs>
  );
}

vi.mock('./BackupList', () => ({
  default: () => <h1>Backup list</h1>,
}));

const server = setupServer(tokenQuery);

describe('ScheduledBackupTabContent', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
    process.env.NEXT_PUBLIC_ENV = 'production';
    server.listen();
  });

  afterAll(() => {
    server.close();
    vi.restoreAllMocks();
  });

  test('that Scheduled backups is loaded if PiTR is not enabled', async () => {
    server.use(getPiTRNotEnabledPostgresSettings);
    server.use(getProjectQuery);
    render(<TestComponent />);
    expect(
      await screen.findByText(/The database backup includes database schema/i),
    ).toBeInTheDocument();
  });

  test('that a warning message is displayed if Point-in-Time Recovery is enabled ', async () => {
    server.use(getProjectQuery);
    server.use(getPostgresSettings);

    render(<TestComponent />);
    expect(
      await screen.findByText(/With Point-in-Time Recovery enabled/i),
    ).toBeInTheDocument();
  });
});

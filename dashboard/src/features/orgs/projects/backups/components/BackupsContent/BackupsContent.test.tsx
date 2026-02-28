import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import { TabsContent } from '@/components/ui/v3/tabs';
import { useIsPiTREnabled } from '@/features/orgs/hooks/useIsPiTREnabled';
import {
  getPiTRNotEnabledPostgresSettings,
  getPostgresSettings,
} from '@/tests/msw/mocks/graphql/getPostgresSettings';
import { getProjectQuery } from '@/tests/msw/mocks/graphql/getProjectQuery';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import { render, screen } from '@/tests/testUtils';
import BackupsContent from './BackupsContent';

function TestComponent() {
  const { isPiTREnabled, loading } = useIsPiTREnabled();
  if (loading) {
    return <h1>Loading...</h1>;
  }
  return <BackupsContent isPiTREnabled={isPiTREnabled} />;
}

vi.mock(
  '@/features/orgs/projects/backups/components/ScheduledBackupTabContent',
  () => ({
    ScheduledBackupTabContent: () => (
      <TabsContent value="scheduledBackups">
        <h1>Scheduled backups is loaded</h1>
      </TabsContent>
    ),
  }),
);

vi.mock(
  '@/features/orgs/projects/backups/components/PointInTimeTabsContent',
  () => ({
    PointInTimeTabsContent: () => (
      <TabsContent value="pointInTime">
        <h1>PiTR tab is loaded</h1>
      </TabsContent>
    ),
  }),
);

const server = setupServer(tokenQuery);

describe('BackupsContent', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
    process.env.NEXT_PUBLIC_ENV = 'production';
    server.listen();
  });

  afterAll(() => {
    server.close();
    vi.restoreAllMocks();
  });

  test('that Scheduled backups tab is loaded when PiTR is not enabled', async () => {
    server.use(getPiTRNotEnabledPostgresSettings);
    server.use(getProjectQuery);
    render(<TestComponent />);
    expect(
      await screen.findByText('Scheduled backups is loaded'),
    ).toBeInTheDocument();
  });

  test('that Point-in-Time tab is loaded when PiTR is enabled', async () => {
    server.use(getPostgresSettings);
    server.use(getProjectQuery);
    render(<TestComponent />);
    expect(await screen.findByText('PiTR tab is loaded')).toBeInTheDocument();
  });
});

import { Tabs } from '@/components/ui/v3/tabs';
import { getOrganization } from '@/tests/msw/mocks/graphql/getOrganizationQuery';
import {
  getPiTRNotEnabledPostgresSettings,
  getPostgresSettings,
} from '@/tests/msw/mocks/graphql/getPostgresSettings';
import { getProjectQuery } from '@/tests/msw/mocks/graphql/getProjectQuery';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import { render, screen } from '@/tests/testUtils';
import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import PointInTimeTabsContent from './PointInTimeTabsContent';

function TestComponent() {
  return (
    <Tabs value="pointInTime">
      <PointInTimeTabsContent />
    </Tabs>
  );
}

vi.mock('./PointInTimeRecovery', () => ({
  default: () => <h1>PiTR enabled</h1>,
}));

const server = setupServer(tokenQuery);

describe('PointInTimeTabsContent', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
    process.env.NEXT_PUBLIC_ENV = 'production';
    server.listen();
  });

  afterAll(() => {
    server.close();
    vi.restoreAllMocks();
  });

  test('if Point-in-Time Recovery is enabled', async () => {
    server.use(getPostgresSettings);
    server.use(getProjectQuery);
    render(<TestComponent />);
    expect(await screen.findByText('PiTR enabled')).toBeInTheDocument();
  });

  test('if Point-in-sTime Recovery is not enabled', async () => {
    server.use(getOrganization);
    server.use(getProjectQuery);
    server.use(getPiTRNotEnabledPostgresSettings);

    render(<TestComponent />);
    expect(
      await screen.findByText(/To enable Point-in-Time recovery/i),
    ).toBeInTheDocument();
  });
});

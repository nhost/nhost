import { graphql, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import { render, screen } from '@/tests/testUtils';
import ServiceVersionGate from './ServiceVersionGate';

vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: () => ({ project: { id: 'test-app-id' }, loading: false }),
}));

const server = setupServer(tokenQuery);

function hasuraVersionHandler(version: string, link = nhostGraphQLLink) {
  return link.query('getConfiguredVersions', () =>
    HttpResponse.json({ data: { config: { hasura: { version } } } }),
  );
}

function renderGate() {
  render(
    <ServiceVersionGate
      service="hasura"
      minVersion="v2.33.0"
      fallback={<p>Upgrade required</p>}
      loadingFallback={<p>Checking version</p>}
    >
      <p>Feature content</p>
    </ServiceVersionGate>,
  );
}

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'true');
});

afterEach(() => {
  server.resetHandlers();
  vi.unstubAllEnvs();
});

afterAll(() => {
  server.close();
});

describe('ServiceVersionGate', () => {
  it('renders the loading fallback, then its children when the version meets the minimum', async () => {
    server.use(hasuraVersionHandler('v2.33.0-ce'));

    renderGate();

    expect(screen.getByText('Checking version')).toBeInTheDocument();
    expect(await screen.findByText('Feature content')).toBeInTheDocument();
    expect(screen.queryByText('Checking version')).not.toBeInTheDocument();
  });

  it('renders the fallback when the version is older than the minimum', async () => {
    server.use(hasuraVersionHandler('v2.25.1-ce'));

    renderGate();

    expect(await screen.findByText('Upgrade required')).toBeInTheDocument();
    expect(screen.queryByText('Feature content')).not.toBeInTheDocument();
  });

  it('renders its children when the version cannot be loaded', async () => {
    server.use(
      nhostGraphQLLink.query('getConfiguredVersions', () =>
        HttpResponse.json({ errors: [{ message: 'Internal error' }] }),
      ),
    );

    renderGate();

    expect(await screen.findByText('Feature content')).toBeInTheDocument();
  });

  it('reads the version from the config server outside the platform', async () => {
    const configServerUrl = 'https://my-config-server.com';
    vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'false');
    vi.stubEnv('NEXT_PUBLIC_NHOST_CONFIGSERVER_URL', configServerUrl);
    server.use(
      hasuraVersionHandler('v2.25.1-ce', graphql.link(configServerUrl)),
    );

    renderGate();

    expect(await screen.findByText('Upgrade required')).toBeInTheDocument();
  });
});

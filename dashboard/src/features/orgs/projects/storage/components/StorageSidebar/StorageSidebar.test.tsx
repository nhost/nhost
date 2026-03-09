import { setupServer } from 'msw/node';
import { afterEach, describe, expect, it, vi } from 'vitest';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import {
  createGraphqlMockResolver,
  render,
  screen,
  waitFor,
} from '@/tests/testUtils';
import StorageSidebar from './StorageSidebar';

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
  useIsPlatform: vi.fn(),
  useProject: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

vi.mock('@/features/orgs/projects/common/hooks/useIsPlatform', () => ({
  useIsPlatform: mocks.useIsPlatform,
}));

vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: mocks.useProject,
}));

const getUseRouterObject = (bucketId?: string) => ({
  basePath: '',
  pathname: '/orgs/[orgSlug]/projects/[appSubdomain]/storage/bucket/[bucketId]',
  route: '/orgs/[orgSlug]/projects/[appSubdomain]/storage/bucket/[bucketId]',
  asPath: bucketId
    ? `/orgs/xyz/projects/test-project/storage/bucket/${bucketId}`
    : '/orgs/xyz/projects/test-project/storage',
  isLocaleDomain: false,
  isReady: true,
  isPreview: false,
  query: {
    orgSlug: 'xyz',
    appSubdomain: 'test-project',
    ...(bucketId && { bucketId }),
  },
  push: vi.fn(),
  replace: vi.fn(),
  reload: vi.fn(),
  back: vi.fn(),
  prefetch: vi.fn(),
  beforePopState: vi.fn(),
  events: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  },
  isFallback: false,
});

const mockBuckets = [
  {
    id: 'default',
    minUploadFileSize: 0,
    maxUploadFileSize: 50000000,
    presignedUrlsEnabled: false,
    downloadExpiration: 30,
    cacheControl: 'max-age=3600',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'avatars',
    minUploadFileSize: 0,
    maxUploadFileSize: 5000000,
    presignedUrlsEnabled: false,
    downloadExpiration: 30,
    cacheControl: 'max-age=3600',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

const server = setupServer(tokenQuery);

describe('StorageSidebar', () => {
  beforeAll(() => {
    server.listen();
  });

  beforeEach(() => {
    server.resetHandlers();
    mocks.useIsPlatform.mockReturnValue(false);
    mocks.useProject.mockReturnValue({
      project: { config: { hasura: { adminSecret: 'secret' } } },
    });
  });

  afterEach(() => {
    mocks.useRouter.mockRestore();
    mocks.useIsPlatform.mockRestore();
    mocks.useProject.mockRestore();
    vi.restoreAllMocks();
  });

  afterAll(() => {
    server.close();
  });

  it('should show loading state while fetching buckets', () => {
    mocks.useRouter.mockReturnValue(getUseRouterObject());
    const resolver = createGraphqlMockResolver('getBuckets', 'query');
    server.use(resolver.handler);

    render(<StorageSidebar />);

    expect(screen.getByText('Loading buckets...')).toBeInTheDocument();
  });

  it('should render bucket list', async () => {
    mocks.useRouter.mockReturnValue(getUseRouterObject());
    const resolver = createGraphqlMockResolver('getBuckets', 'query');
    server.use(resolver.handler);

    render(<StorageSidebar />);

    resolver.resolve({ buckets: mockBuckets });

    await waitFor(() => {
      expect(screen.getByText('default')).toBeInTheDocument();
      expect(screen.getByText('avatars')).toBeInTheDocument();
    });
  });

  it('should show empty state when no buckets exist', async () => {
    mocks.useRouter.mockReturnValue(getUseRouterObject());
    const resolver = createGraphqlMockResolver('getBuckets', 'query');
    server.use(resolver.handler);

    render(<StorageSidebar />);

    resolver.resolve({ buckets: [] });

    await waitFor(() => {
      expect(screen.getByText('No buckets found.')).toBeInTheDocument();
    });
  });

  it('should highlight the selected bucket', async () => {
    mocks.useRouter.mockReturnValue(getUseRouterObject('default'));
    const resolver = createGraphqlMockResolver('getBuckets', 'query');
    server.use(resolver.handler);

    render(<StorageSidebar />);

    resolver.resolve({ buckets: mockBuckets });

    await waitFor(() => {
      const defaultLink = screen.getByRole('link', { name: /default/i });
      expect(defaultLink).toHaveClass('text-primary-main');
    });
  });

  it('should always display the default bucket first', async () => {
    mocks.useRouter.mockReturnValue(getUseRouterObject());
    const resolver = createGraphqlMockResolver('getBuckets', 'query');
    server.use(resolver.handler);

    render(<StorageSidebar />);

    resolver.resolve({
      buckets: [mockBuckets[1], mockBuckets[0]],
    });

    await waitFor(() => {
      const links = screen.getAllByRole('link');
      expect(links[0]).toHaveTextContent('default');
      expect(links[1]).toHaveTextContent('avatars');
    });
  });

  it('should generate correct bucket links', async () => {
    mocks.useRouter.mockReturnValue(getUseRouterObject());
    const resolver = createGraphqlMockResolver('getBuckets', 'query');
    server.use(resolver.handler);

    render(<StorageSidebar />);

    resolver.resolve({ buckets: mockBuckets });

    await waitFor(() => {
      const defaultLink = screen.getByRole('link', { name: /default/i });
      const avatarsLink = screen.getByRole('link', { name: /avatars/i });
      expect(defaultLink).toHaveAttribute(
        'href',
        '/orgs/xyz/projects/test-project/storage/bucket/default',
      );
      expect(avatarsLink).toHaveAttribute(
        'href',
        '/orgs/xyz/projects/test-project/storage/bucket/avatars',
      );
    });
  });
});

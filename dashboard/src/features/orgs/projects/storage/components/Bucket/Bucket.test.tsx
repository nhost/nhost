import { setupServer } from 'msw/node';
import { afterEach, describe, expect, it, vi } from 'vitest';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import {
  createGraphqlMockResolver,
  render,
  screen,
  waitFor,
} from '@/tests/testUtils';
import Bucket from './Bucket';

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

vi.mock(
  '@/features/orgs/projects/storage/dataGrid/components/FilesDataGrid',
  () => ({
    FilesDataGrid: () => <div data-testid="files-data-grid" />,
  }),
);

const getUseRouterObject = (bucketId: string = 'default') => ({
  basePath: '',
  pathname: '/orgs/xyz/projects/test-project/storage/bucket/[bucketId]',
  route: '/orgs/[orgSlug]/projects/[appSubdomain]/storage/bucket/[bucketId]',
  asPath: `/orgs/xyz/projects/test-project/storage/bucket/${bucketId}`,
  isLocaleDomain: false,
  isReady: true,
  isPreview: false,
  query: {
    orgSlug: 'xyz',
    appSubdomain: 'test-project',
    bucketId,
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

const server = setupServer(tokenQuery);

describe('Bucket', () => {
  beforeAll(() => {
    server.listen();
  });

  beforeEach(() => {
    server.resetHandlers();
  });

  afterEach(() => {
    mocks.useRouter.mockRestore();
    vi.restoreAllMocks();
  });

  afterAll(() => {
    server.close();
  });

  it('should show loading state while fetching bucket', () => {
    mocks.useRouter.mockReturnValue(getUseRouterObject());
    const resolver = createGraphqlMockResolver('getBucket', 'query');
    server.use(resolver.handler);

    render(<Bucket />);

    expect(screen.getByText('Loading bucket...')).toBeInTheDocument();
  });

  it('should render FilesDataGrid when bucket is found', async () => {
    mocks.useRouter.mockReturnValue(getUseRouterObject());
    const resolver = createGraphqlMockResolver('getBucket', 'query');
    server.use(resolver.handler);

    render(<Bucket />);

    resolver.resolve({
      bucket: {
        id: 'default',
        minUploadFileSize: 0,
        maxUploadFileSize: 50000000,
        presignedUrlsEnabled: false,
        downloadExpiration: 30,
        cacheControl: 'max-age=3600',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId('files-data-grid')).toBeInTheDocument();
    });
  });

  it('should show not found state when bucket does not exist', async () => {
    mocks.useRouter.mockReturnValue(getUseRouterObject('non-existent'));
    const resolver = createGraphqlMockResolver('getBucket', 'query');
    server.use(resolver.handler);

    render(<Bucket />);

    resolver.resolve({ bucket: null });

    await waitFor(() => {
      expect(screen.getByText('Bucket not found')).toBeInTheDocument();
      expect(screen.getByText('non-existent')).toBeInTheDocument();
    });
  });
});

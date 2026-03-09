import { setupServer } from 'msw/node';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import {
  createGraphqlMockResolver,
  render,
  screen,
  waitFor,
} from '@/tests/testUtils';
import useBuckets from './useBuckets';

const server = setupServer(tokenQuery);

const makeBucket = (id: string) => ({
  id,
  minUploadFileSize: 1,
  maxUploadFileSize: 50000000,
  presignedUrlsEnabled: true,
  downloadExpiration: 30,
  cacheControl: 'max-age=3600',
});

function TestComponent() {
  const { buckets, loading } = useBuckets();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <ul>
      {buckets.map((bucket) => (
        <li key={bucket.id} data-testid="bucket">
          {bucket.id}
        </li>
      ))}
    </ul>
  );
}

describe('useBuckets', () => {
  beforeAll(() => {
    server.listen();
  });

  beforeEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  it('should place the default bucket first', async () => {
    const resolver = createGraphqlMockResolver('getBuckets', 'query');
    server.use(resolver.handler);

    render(<TestComponent />);

    resolver.resolve({
      buckets: [
        makeBucket('avatars'),
        makeBucket('default'),
        makeBucket('uploads'),
      ],
    });

    await waitFor(() => {
      const items = screen.getAllByTestId('bucket');
      expect(items).toHaveLength(3);
      expect(items[0]).toHaveTextContent('default');
      expect(items[1]).toHaveTextContent('avatars');
      expect(items[2]).toHaveTextContent('uploads');
    });
  });

  it('should return buckets as-is when no default bucket exists', async () => {
    const resolver = createGraphqlMockResolver('getBuckets', 'query');
    server.use(resolver.handler);

    render(<TestComponent />);

    resolver.resolve({
      buckets: [makeBucket('avatars'), makeBucket('uploads')],
    });

    await waitFor(() => {
      const items = screen.getAllByTestId('bucket');
      expect(items).toHaveLength(2);
      expect(items[0]).toHaveTextContent('avatars');
      expect(items[1]).toHaveTextContent('uploads');
    });
  });

  it('should return empty state when no buckets exist', async () => {
    const resolver = createGraphqlMockResolver('getBuckets', 'query');
    server.use(resolver.handler);

    render(<TestComponent />);

    resolver.resolve({ buckets: [] });

    await waitFor(() => {
      expect(screen.queryAllByTestId('bucket')).toHaveLength(0);
    });
  });
});

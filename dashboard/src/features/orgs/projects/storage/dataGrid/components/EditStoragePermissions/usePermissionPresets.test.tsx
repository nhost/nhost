import { setupServer } from 'msw/node';
import { vi } from 'vitest';

import { getProjectQuery } from '@/tests/msw/mocks/graphql/getProjectQuery';
import {
  createGraphqlMockResolver,
  render,
  screen,
  waitFor,
} from '@/tests/testUtils';

import usePermissionPresets from './usePermissionPresets';

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

function getRouter() {
  return {
    basePath: '',
    pathname: '/orgs/xyz/projects/test-project',
    route: '/orgs/[orgSlug]/projects/[appSubdomain]',
    asPath: '/orgs/xyz/projects/test-project',
    isLocaleDomain: false,
    isReady: true,
    isPreview: false,
    query: {
      orgSlug: 'xyz',
      appSubdomain: 'test-project',
      dataSourceSlug: 'default',
    },
    push: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
    beforePopState: vi.fn(),
    events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    isFallback: false,
  };
}

const server = setupServer(getProjectQuery);

function TestComponent() {
  const { presetGroups, isLoading } = usePermissionPresets();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <ul>
      {presetGroups.map((group) => (
        <li key={group.label} data-testid="group" data-label={group.label}>
          {group.presets.map((preset) => {
            const node = preset.createNode();
            return (
              <span
                key={preset.id}
                data-testid="preset"
                data-node={JSON.stringify(node)}
              >
                {preset.label}
              </span>
            );
          })}
        </li>
      ))}
    </ul>
  );
}

describe('usePermissionPresets', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_ENV = 'dev';
    process.env.NEXT_PUBLIC_NHOST_CONFIGSERVER_URL =
      'https://local.graphql.local.nhost.run/v1';
    server.listen();
  });

  beforeEach(() => {
    mocks.useRouter.mockReturnValue(getRouter());
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  it('returns two groups: "Rules for bucket" and "Own files in bucket"', async () => {
    const resolver = createGraphqlMockResolver('getBuckets', 'query');
    server.use(resolver.handler);

    render(<TestComponent />);
    resolver.resolve({ buckets: [{ id: 'default' }] });

    await waitFor(() => {
      const groups = screen.getAllByTestId('group');
      expect(groups).toHaveLength(2);
      expect(groups[0]).toHaveAttribute('data-label', 'Rules for bucket');
      expect(groups[1]).toHaveAttribute('data-label', 'Own files in bucket');
    });
  });

  it('both groups have empty presets when no buckets exist', async () => {
    const resolver = createGraphqlMockResolver('getBuckets', 'query');
    server.use(resolver.handler);

    render(<TestComponent />);
    resolver.resolve({ buckets: [] });

    await waitFor(() => {
      expect(screen.getAllByTestId('group')).toHaveLength(2);
    });

    expect(screen.queryAllByTestId('preset')).toHaveLength(0);
  });

  it('"Rules for bucket" preset creates node with bucket_id condition', async () => {
    const resolver = createGraphqlMockResolver('getBuckets', 'query');
    server.use(resolver.handler);

    render(<TestComponent />);
    resolver.resolve({ buckets: [{ id: 'avatars' }] });

    await waitFor(() => {
      expect(screen.getAllByTestId('preset')).toHaveLength(2);
    });

    const presets = screen.getAllByTestId('preset');
    const node = JSON.parse(presets[0].dataset.node!);

    expect(node.type).toBe('group');
    expect(node.operator).toBe('_and');
    expect(node.children).toHaveLength(1);
    expect(node.children[0]).toMatchObject({
      type: 'condition',
      column: 'bucket_id',
      operator: '_eq',
      value: 'avatars',
    });
  });

  it('"Own files in bucket" preset creates node with bucket_id + uploaded_by_user_id', async () => {
    const resolver = createGraphqlMockResolver('getBuckets', 'query');
    server.use(resolver.handler);

    render(<TestComponent />);
    resolver.resolve({ buckets: [{ id: 'avatars' }] });

    await waitFor(() => {
      expect(screen.getAllByTestId('preset')).toHaveLength(2);
    });

    const presets = screen.getAllByTestId('preset');
    const node = JSON.parse(presets[1].dataset.node!);

    expect(node.type).toBe('group');
    expect(node.operator).toBe('_and');
    expect(node.children).toHaveLength(2);
    expect(node.children[0]).toMatchObject({
      type: 'condition',
      column: 'bucket_id',
      operator: '_eq',
      value: 'avatars',
    });
    expect(node.children[1]).toMatchObject({
      type: 'condition',
      column: 'uploaded_by_user_id',
      operator: '_eq',
      value: 'X-Hasura-User-Id',
    });
  });

  it('creates presets for each bucket', async () => {
    const resolver = createGraphqlMockResolver('getBuckets', 'query');
    server.use(resolver.handler);

    render(<TestComponent />);
    resolver.resolve({
      buckets: [{ id: 'default' }, { id: 'avatars' }, { id: 'uploads' }],
    });

    await waitFor(() => {
      // 3 buckets x 2 groups = 6 presets
      expect(screen.getAllByTestId('preset')).toHaveLength(6);
    });

    const presets = screen.getAllByTestId('preset');
    expect(presets[0]).toHaveTextContent('default');
    expect(presets[1]).toHaveTextContent('avatars');
    expect(presets[2]).toHaveTextContent('uploads');
    expect(presets[3]).toHaveTextContent('default');
    expect(presets[4]).toHaveTextContent('avatars');
    expect(presets[5]).toHaveTextContent('uploads');
  });
});

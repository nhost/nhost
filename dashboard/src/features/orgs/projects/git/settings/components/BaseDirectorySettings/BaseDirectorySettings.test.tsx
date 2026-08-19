import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { mockApplication, mockMatchMediaValue } from '@/tests/mocks';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import { render, screen, TestUserEvent } from '@/tests/testUtils';
import BaseDirectorySettings from './BaseDirectorySettings';

const mocks = vi.hoisted(() => ({
  refetchProject: vi.fn(),
}));

vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: () => ({
    project: mockApplication,
    refetch: mocks.refetchProject,
  }),
}));

const server = setupServer(
  tokenQuery,
  nhostGraphQLLink.mutation('updateApplication', () =>
    HttpResponse.json({ data: { updateApp: mockApplication } }),
  ),
);

beforeAll(() => {
  server.listen();
  window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
});

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'true');
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

afterAll(() => server.close());

describe('BaseDirectorySettings', () => {
  it('refetches the project after a successful update', async () => {
    const user = new TestUserEvent();
    render(<BaseDirectorySettings />);

    const input = await screen.findByRole('textbox');
    await user.clear(input);
    await user.type(input, 'apps/web');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByText(
      'The base directory has been updated successfully.',
    );
    expect(mocks.refetchProject).toHaveBeenCalledOnce();
  });
});

import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { mockApplication, mockMatchMediaValue } from '@/tests/mocks';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import {
  queryClient,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import DeploymentBranchSettings from './DeploymentBranchSettings';

let storedProductionBranch = 'main';

const server = setupServer(
  tokenQuery,
  nhostGraphQLLink.query('getProject', () =>
    HttpResponse.json({
      data: {
        apps: [
          {
            ...mockApplication,
            repositoryProductionBranch: storedProductionBranch,
          },
        ],
      },
    }),
  ),
  nhostGraphQLLink.mutation('updateApplication', () => {
    storedProductionBranch = 'staging';
    return HttpResponse.json({ data: { updateApp: mockApplication } });
  }),
);

beforeAll(() => {
  server.listen();
  window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
});

beforeEach(() => {
  storedProductionBranch = 'main';
  vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'true');
});

afterEach(() => {
  queryClient.clear();
  vi.unstubAllEnvs();
});

afterAll(() => server.close());

describe('DeploymentBranchSettings', () => {
  it('refetches the project after a successful update', async () => {
    const user = new TestUserEvent();
    render(<DeploymentBranchSettings />);

    const input = await screen.findByRole('textbox');
    await user.clear(input);
    await user.type(input, 'production');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByText(
      'The deployment branch has been updated successfully.',
    );
    // only the refetch can bring in a value the form never submitted
    await waitFor(() => expect(input).toHaveValue('staging'));
  });
});

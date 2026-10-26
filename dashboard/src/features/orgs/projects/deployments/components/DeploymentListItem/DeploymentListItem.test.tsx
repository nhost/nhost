import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { toast } from 'react-hot-toast';
import type {
  InsertPipelineRunMutationVariables,
  UnifiedDeploymentRowFragment,
} from '@/generated/graphql';
import {
  mockApplication,
  mockMatchMediaValue,
  mockOrganization,
  mockRouter,
} from '@/tests/mocks';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import {
  queryClient,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import DeploymentListItem from './DeploymentListItem';

vi.mock('next/router', () => ({
  useRouter: () => ({
    query: { orgSlug: 'xyz', appSubdomain: 'test-project' },
    isReady: true,
  }),
}));

const deployment: UnifiedDeploymentRowFragment = {
  id: 'target',
  appId: 'test-app-id',
  source: 'pipeline_run',
  commitSHA: 'b'.repeat(40),
  commitMessage: 'Target commit',
  commitUserName: 'Alice',
  commitUserAvatarUrl: null,
  status: 'succeeded',
  createdAt: '2026-10-19T12:00:00Z',
  startedAt: '2026-10-19T12:01:00Z',
  endedAt: '2026-10-19T12:02:00Z',
};
const requests: InsertPipelineRunMutationVariables[] = [];
const server = setupServer(
  tokenQuery,
  http.post('https://local.graphql.local.nhost.run/v1', async ({ request }) => {
    const { operationName, variables } = (await request.json()) as {
      operationName: string;
      variables: InsertPipelineRunMutationVariables;
    };
    switch (operationName) {
      case 'getProject':
        return HttpResponse.json({ data: { apps: [mockApplication] } });
      case 'getOrganization':
        return HttpResponse.json({
          data: { organizations: [mockOrganization] },
        });
      case 'GetOrganizations':
        return HttpResponse.json({ data: { organizations: [] } });
      case 'InsertPipelineRun':
        requests.push(variables);
        return HttpResponse.json({
          data: {
            insertPipelineRun: {
              id: 'new',
              name: 'nhost-backend-build',
              status: 'pending',
              appId: deployment.appId,
              input: variables.object.input,
              createdAt: deployment.createdAt,
              startedAt: null,
              endedAt: null,
            },
          },
        });
      default:
        return HttpResponse.json({ data: {} });
    }
  }),
);

beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
  // Hovering the row link prefetches its page, which returns a promise.
  vi.mocked(mockRouter.prefetch).mockResolvedValue(undefined);
  server.listen({ onUnhandledRequest: 'error' });
});
beforeEach(() => {
  process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
  vi.mocked(mockRouter.push).mockClear();
  requests.length = 0;
});
afterEach(() => {
  server.resetHandlers();
  queryClient.clear();
  toast.remove();
});
afterAll(() => server.close());

it('redeploys the commit of the row', async () => {
  render(
    <ul>
      <DeploymentListItem deployment={deployment} showRedeploy />
    </ul>,
  );

  await new TestUserEvent().click(
    await screen.findByRole('button', { name: 'Redeploy' }),
  );

  await waitFor(() => expect(requests).toHaveLength(1));
  expect(requests[0].object.input).toEqual({
    name: 'nhost-backend-build',
    app_id: mockApplication.id,
    commit_sha: deployment.commitSHA,
    commit_message: deployment.commitMessage,
    commit_user_name: deployment.commitUserName,
    commit_user_avatar_url: deployment.commitUserAvatarUrl,
  });
  expect(mockRouter.push).not.toHaveBeenCalled();
});

it.each([
  {
    name: 'the short SHA of a commit',
    commitSHA: 'b'.repeat(40),
    shown: 'bbbbbbb',
    button: 'Copy commit SHA',
    toastText: 'Commit SHA copied to clipboard',
  },
  {
    name: 'a branch in full',
    commitSHA: 'feat/comments-and-reactions',
    shown: 'feat/comments-and-reactions',
    button: 'Copy ref',
    toastText: 'Ref copied to clipboard',
  },
])(
  'shows $name and copies it in full without opening the deployment',
  async ({ commitSHA, shown, button, toastText }) => {
    const user = new TestUserEvent();
    render(
      <ul>
        <DeploymentListItem deployment={{ ...deployment, commitSHA }} />
      </ul>,
    );
    expect(await screen.findByText(shown)).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: button }));

    await waitFor(async () =>
      expect(await navigator.clipboard.readText()).toBe(commitSHA),
    );
    expect(await screen.findByText(toastText)).toBeInTheDocument();
    expect(mockRouter.push).not.toHaveBeenCalled();
  },
);

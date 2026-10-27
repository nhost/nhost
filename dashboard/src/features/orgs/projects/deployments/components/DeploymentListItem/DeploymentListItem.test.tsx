import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { toast } from 'react-hot-toast';
import type {
  InsertPipelineRunMutationVariables,
  UnifiedDeploymentRowFragment,
} from '@/generated/graphql';
import {
  mockApplication,
  mockMatchMediaValue,
  mockRouter,
} from '@/tests/mocks';
import {
  getOrganization,
  getOrganizations,
} from '@/tests/msw/mocks/graphql/getOrganizationQuery';
import { getProjectQuery } from '@/tests/msw/mocks/graphql/getProjectQuery';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import {
  queryClient,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import DeploymentListItem from './DeploymentListItem';

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
  getProjectQuery,
  getOrganization,
  getOrganizations,
  nhostGraphQLLink.mutation<object, InsertPipelineRunMutationVariables>(
    'InsertPipelineRun',
    ({ variables }) => {
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
    },
  ),
);

beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
  // A click hovers the row's link first, and next/link then prefetches the
  // deployment's page. Like Next's router, the test router has to return a
  // promise for that.
  vi.mocked(mockRouter.prefetch).mockResolvedValue(undefined);
  server.listen({ onUnhandledRequest: 'error' });
});
beforeEach(() => {
  process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
  vi.mocked(mockRouter.push).mockClear();
  requests.length = 0;
});
afterEach(() => {
  queryClient.clear();
  toast.remove();
});
afterAll(() => server.close());

it('redeploys the commit of the row without opening the deployment', async () => {
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

it('shows the short SHA of a commit and copies it in full without opening the deployment', async () => {
  const user = new TestUserEvent();
  render(
    <ul>
      <DeploymentListItem deployment={deployment} />
    </ul>,
  );
  expect(await screen.findByText('bbbbbbb')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Copy Commit SHA' }));

  await waitFor(async () =>
    expect(await navigator.clipboard.readText()).toBe(deployment.commitSHA),
  );
  expect(
    await screen.findByText('Commit SHA copied to clipboard'),
  ).toBeInTheDocument();
  expect(mockRouter.push).not.toHaveBeenCalled();
});

it('shows a branch in full and copies it without opening the deployment', async () => {
  const user = new TestUserEvent();
  render(
    <ul>
      <DeploymentListItem
        deployment={{ ...deployment, commitSHA: 'feat/comments-and-reactions' }}
      />
    </ul>,
  );
  expect(
    await screen.findByText('feat/comments-and-reactions'),
  ).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Copy Ref' }));

  await waitFor(async () =>
    expect(await navigator.clipboard.readText()).toBe(
      'feat/comments-and-reactions',
    ),
  );
  expect(
    await screen.findByText('Ref copied to clipboard'),
  ).toBeInTheDocument();
  expect(mockRouter.push).not.toHaveBeenCalled();
});

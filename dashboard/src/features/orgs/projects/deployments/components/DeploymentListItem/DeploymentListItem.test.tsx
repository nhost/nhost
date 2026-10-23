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
  within,
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
const live: UnifiedDeploymentRowFragment = {
  ...deployment,
  id: 'live',
  commitSHA: 'a'.repeat(40),
  commitMessage: 'Live commit',
  createdAt: '2026-10-20T12:00:00Z',
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
  requests.length = 0;
});
afterEach(() => {
  server.resetHandlers();
  queryClient.clear();
  toast.remove();
});
afterAll(() => server.close());

async function findRow() {
  const link = await screen.findByRole('link', { name: 'Target commit' });
  await waitFor(() =>
    expect(link).toHaveAttribute(
      'href',
      '/orgs/xyz/projects/test-project/deployments/target',
    ),
  );
  return link;
}

it.each([
  {
    name: 'the live commit, even from another deployment',
    liveDeployment: { ...live, commitSHA: deployment.commitSHA },
  },
  { name: 'a commit when nothing is live', liveDeployment: null },
])('redeploys $name without asking', async ({ liveDeployment }) => {
  render(
    <ul>
      <DeploymentListItem
        deployment={deployment}
        liveDeployment={liveDeployment}
      />
    </ul>,
  );
  await findRow();
  await new TestUserEvent().click(
    screen.getByRole('button', { name: 'Redeploy' }),
  );

  await waitFor(() => expect(requests).toHaveLength(1));
  expect(requests[0].object.input.commit_sha).toBe(deployment.commitSHA);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('asks before redeploying a commit that is not live', async () => {
  render(
    <ul>
      <DeploymentListItem deployment={deployment} liveDeployment={live} />
    </ul>,
  );
  await findRow();
  const user = new TestUserEvent();
  await user.click(screen.getByRole('button', { name: 'Redeploy' }));

  const dialog = await screen.findByRole('dialog');
  expect(
    within(dialog).getByRole('heading', { name: 'Redeploy an older commit?' }),
  ).toBeInTheDocument();
  expect(requests).toHaveLength(0);

  await user.click(within(dialog).getByRole('button', { name: 'Redeploy' }));
  await waitFor(() => expect(requests).toHaveLength(1));
  expect(requests[0].object.input.commit_sha).toBe(deployment.commitSHA);
});

it('shows Live only on the live deployment, not on others with its commit', async () => {
  const { rerender } = render(
    <ul>
      <DeploymentListItem deployment={live} liveDeployment={live} />
    </ul>,
  );
  expect(await screen.findByText('Live')).toBeInTheDocument();

  rerender(
    <ul>
      <DeploymentListItem
        deployment={{ ...live, id: 'other' }}
        liveDeployment={live}
      />
    </ul>,
  );
  expect(screen.queryByText('Live')).not.toBeInTheDocument();
});

it('disables Redeploy while a deployment is in progress', async () => {
  render(
    <ul>
      <DeploymentListItem
        deployment={deployment}
        liveDeployment={live}
        disableRedeploy
      />
    </ul>,
  );
  await findRow();

  expect(screen.getByRole('button', { name: 'Redeploy' })).toBeDisabled();
});

it('offers no Redeploy for a deployment without a commit', async () => {
  render(
    <ul>
      <DeploymentListItem
        deployment={{ ...deployment, commitSHA: null }}
        liveDeployment={live}
        alwaysShowRedeploy
      />
    </ul>,
  );
  await findRow();

  expect(
    screen.queryByRole('button', { name: 'Redeploy' }),
  ).not.toBeInTheDocument();
});

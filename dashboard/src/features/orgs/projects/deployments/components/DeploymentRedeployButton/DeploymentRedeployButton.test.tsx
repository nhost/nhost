import userEvent from '@testing-library/user-event';
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
import DeploymentRedeployButton from './DeploymentRedeployButton';

vi.mock('next/router', () => ({
  useRouter: () => ({
    query: { orgSlug: 'xyz', appSubdomain: 'test-project' },
    isReady: true,
  }),
}));

const target: UnifiedDeploymentRowFragment = {
  id: 'target',
  appId: mockApplication.id,
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
  ...target,
  id: 'live',
  commitSHA: 'a'.repeat(40),
  commitMessage: 'Live commit',
  createdAt: '2026-10-20T12:00:00Z',
};

interface Scenario {
  live: UnifiedDeploymentRowFragment[];
  pending: UnifiedDeploymentRowFragment[];
  liveError?: boolean;
}

const requests: InsertPipelineRunMutationVariables[] = [];
const served: string[] = [];
const server = setupServer(tokenQuery);

function serve({ live: liveRows, pending, liveError }: Scenario) {
  server.use(
    http.post(
      'https://local.graphql.local.nhost.run/v1',
      async ({ request }) => {
        const { operationName, variables } = (await request.json()) as {
          operationName: string;
          variables: InsertPipelineRunMutationVariables;
        };
        served.push(operationName);
        switch (operationName) {
          case 'getProject':
            return HttpResponse.json({ data: { apps: [mockApplication] } });
          case 'getOrganization':
            return HttpResponse.json({
              data: { organizations: [mockOrganization] },
            });
          case 'GetOrganizations':
            return HttpResponse.json({ data: { organizations: [] } });
          case 'UnifiedDeploymentSub':
            return HttpResponse.json({
              data: { unifiedDeployments: [target] },
            });
          case 'LatestLiveUnifiedDeploymentSub':
            return liveError
              ? HttpResponse.json({ errors: [{ message: 'Unavailable' }] })
              : HttpResponse.json({ data: { unifiedDeployments: liveRows } });
          case 'PendingOrRunningUnifiedDeploymentsSub':
            return HttpResponse.json({
              data: { unifiedDeployments: pending },
            });
          case 'InsertPipelineRun':
            requests.push(variables);
            return HttpResponse.json({
              data: {
                insertPipelineRun: {
                  id: 'new',
                  name: 'nhost-backend-build',
                  status: 'pending',
                  appId: target.appId,
                  input: variables.object.input,
                  createdAt: target.createdAt,
                  startedAt: null,
                  endedAt: null,
                },
              },
            });
          default:
            return HttpResponse.json({ data: {} });
        }
      },
    ),
  );
}

beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
  server.listen({ onUnhandledRequest: 'error' });
});
beforeEach(() => {
  process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
  requests.length = 0;
  served.length = 0;
});
afterEach(() => {
  server.resetHandlers();
  queryClient.clear();
  toast.remove();
});
afterAll(() => server.close());

it('redeploys the live commit without asking', async () => {
  serve({ live: [{ ...live, commitSHA: target.commitSHA }], pending: [] });
  render(<DeploymentRedeployButton deploymentId="target" />);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Redeploy' })).toBeEnabled(),
  );

  await new TestUserEvent().click(
    screen.getByRole('button', { name: 'Redeploy' }),
  );

  await waitFor(() => expect(requests).toHaveLength(1));
  expect(requests[0].object.input.commit_sha).toBe(target.commitSHA);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('asks before redeploying a commit that is not live', async () => {
  serve({ live: [live], pending: [] });
  render(<DeploymentRedeployButton deploymentId="target" />);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Redeploy' })).toBeEnabled(),
  );
  const user = new TestUserEvent();
  await user.click(screen.getByRole('button', { name: 'Redeploy' }));

  const dialog = await screen.findByRole('dialog');
  expect(
    within(dialog).getByRole('heading', { name: 'Redeploy an older commit?' }),
  ).toBeInTheDocument();
  await user.click(within(dialog).getByRole('button', { name: 'Redeploy' }));
  await waitFor(() => expect(requests).toHaveLength(1));
  expect(requests[0].object.input.commit_sha).toBe(target.commitSHA);
});

it('disables Redeploy while a deployment is in progress', async () => {
  serve({ live: [live], pending: [{ ...live, id: 'running' }] });
  render(<DeploymentRedeployButton deploymentId="target" />);

  await waitFor(async () => {
    await userEvent.hover(
      screen.getByRole('button', { name: 'Redeploy' }).parentElement as Element,
    );
    expect(screen.getByRole('tooltip')).toHaveTextContent(
      'Deployments cannot be re-triggered when a deployment is in progress.',
    );
  });
  expect(screen.getByRole('button', { name: 'Redeploy' })).toBeDisabled();
});

it('keeps Redeploy disabled when the live deployment cannot be loaded', async () => {
  serve({ live: [], pending: [], liveError: true });
  render(<DeploymentRedeployButton deploymentId="target" />);

  await waitFor(() =>
    expect(served).toEqual(
      expect.arrayContaining([
        'UnifiedDeploymentSub',
        'LatestLiveUnifiedDeploymentSub',
        'PendingOrRunningUnifiedDeploymentsSub',
      ]),
    ),
  );
  // Give Apollo time to deliver the responses before checking.
  await new Promise((resolve) => {
    setTimeout(resolve, 100);
  });
  expect(screen.getByRole('button', { name: 'Redeploy' })).toBeDisabled();
});

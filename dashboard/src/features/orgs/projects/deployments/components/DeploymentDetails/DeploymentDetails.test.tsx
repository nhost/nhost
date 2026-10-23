import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { toast } from 'react-hot-toast';
import {
  type DeploymentFragment,
  type InsertPipelineRunMutationVariables,
  type PipelineRunFragment,
  PipelineRunStatus_Enum,
  type UnifiedDeploymentRowFragment,
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
import DeploymentDetails from './DeploymentDetails';

vi.mock('next/router', () => ({
  useRouter: () => ({
    query: {
      orgSlug: 'xyz',
      appSubdomain: 'test-project',
      deploymentId: 'target',
    },
    isReady: true,
  }),
}));

const live: UnifiedDeploymentRowFragment = {
  id: 'live',
  appId: mockApplication.id,
  source: 'pipeline_run',
  commitSHA: 'a'.repeat(40),
  commitMessage: 'Live commit',
  commitUserName: 'Alice',
  commitUserAvatarUrl: null,
  status: 'succeeded',
  createdAt: '2026-10-20T12:00:00Z',
  startedAt: '2026-10-20T12:01:00Z',
  endedAt: '2026-10-20T12:02:00Z',
};

const failedBeforeStarting: PipelineRunFragment = {
  id: 'target',
  name: 'nhost-backend-build',
  appId: mockApplication.id,
  status: PipelineRunStatus_Enum.Failed,
  input: {
    name: 'nhost-backend-build',
    app_id: mockApplication.id,
    commit_sha: 'b'.repeat(40),
    commit_message: 'Pipeline run commit',
    commit_user_name: 'Bob',
  },
  substatus: null,
  createdAt: '2026-10-19T12:00:00Z',
  startedAt: null,
  endedAt: null,
};

const failedLegacyDeployment: DeploymentFragment = {
  id: 'target',
  commitSHA: 'c'.repeat(40),
  commitMessage: 'Legacy commit',
  commitUserName: 'Bob',
  commitUserAvatarUrl: null,
  deploymentStatus: 'FAILED',
  deploymentStartedAt: '2026-10-21T12:01:00Z',
  deploymentEndedAt: '2026-10-21T12:02:00Z',
  deploymentLogs: [],
};

const requests: InsertPipelineRunMutationVariables[] = [];
const server = setupServer(tokenQuery);

function serve(
  pipelineRun: PipelineRunFragment | null,
  deployment: DeploymentFragment | null,
) {
  server.use(
    http.post(
      'https://local.graphql.local.nhost.run/v1',
      async ({ request }) => {
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
          case 'getPipelineRun':
            return HttpResponse.json({ data: { pipelineRun } });
          case 'getLegacyDeployment':
            return HttpResponse.json({ data: { deployment } });
          case 'LatestLiveUnifiedDeploymentSub':
            return HttpResponse.json({
              data: { unifiedDeployments: [live] },
            });
          case 'PendingOrRunningUnifiedDeploymentsSub':
            return HttpResponse.json({ data: { unifiedDeployments: [] } });
          case 'InsertPipelineRun':
            requests.push(variables);
            return HttpResponse.json({
              data: {
                insertPipelineRun: {
                  id: 'new',
                  name: 'nhost-backend-build',
                  status: 'pending',
                  appId: mockApplication.id,
                  input: variables.object.input,
                  createdAt: live.createdAt,
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
});
afterEach(() => {
  server.resetHandlers();
  queryClient.clear();
  toast.remove();
});
afterAll(() => server.close());

it.each([
  {
    name: 'a pipeline run that failed before starting',
    pipelineRun: failedBeforeStarting,
    deployment: null,
    title: 'Redeploy an older commit?',
    commitSHA: 'b'.repeat(40),
    commitMessage: 'Pipeline run commit',
  },
  {
    name: 'a failed legacy deployment',
    pipelineRun: null,
    deployment: failedLegacyDeployment,
    title: 'Redeploy a failed commit?',
    commitSHA: 'c'.repeat(40),
    commitMessage: 'Legacy commit',
  },
])(
  'redeploys $name after confirming',
  async ({ pipelineRun, deployment, title, commitSHA, commitMessage }) => {
    serve(pipelineRun, deployment);
    render(<DeploymentDetails />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Redeploy' })).toBeEnabled(),
    );
    const user = new TestUserEvent();
    await user.click(screen.getByRole('button', { name: 'Redeploy' }));

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByRole('heading', { name: title }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(commitMessage)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Redeploy' }));

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0].object.input).toMatchObject({
      commit_sha: commitSHA,
      commit_message: commitMessage,
    });
  },
);

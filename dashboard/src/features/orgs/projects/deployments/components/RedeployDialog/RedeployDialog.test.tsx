import { graphql, HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/v3/button';
import { useRedeployDeployment } from '@/features/orgs/projects/deployments/hooks/useRedeployDeployment';
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
import RedeployDialog from './RedeployDialog';

vi.mock('next/router', () => ({
  useRouter: () => ({
    query: { orgSlug: 'xyz', appSubdomain: 'test-project' },
    isReady: true,
  }),
}));

const live: UnifiedDeploymentRowFragment = {
  id: 'live',
  appId: 'test-app-id',
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
const target: UnifiedDeploymentRowFragment = {
  ...live,
  id: 'target',
  commitSHA: 'b'.repeat(40),
  commitMessage: 'Target commit',
  createdAt: '2026-10-19T12:00:00Z',
  startedAt: '2026-10-19T12:01:00Z',
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
              id: 'new-run',
              name: 'nhost-backend-build',
              status: 'pending',
              input: variables.object.input,
              appId: target.appId,
              createdAt: target.createdAt,
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

function RedeployControl({
  deployment = target,
  inProgress = false,
}: {
  deployment?: UnifiedDeploymentRowFragment;
  inProgress?: boolean;
}) {
  const { redeploy, confirm, cancel, warning, scheduling } =
    useRedeployDeployment(deployment, live);
  return (
    <>
      <Button onClick={redeploy}>Open redeploy</Button>
      {warning && (
        <RedeployDialog
          deployment={deployment}
          liveDeployment={live}
          warning={warning}
          inProgress={inProgress}
          scheduling={scheduling}
          onCancel={cancel}
          onConfirm={confirm}
        />
      )}
    </>
  );
}

async function openDialog() {
  const user = new TestUserEvent();
  await user.click(screen.getByRole('button', { name: 'Open redeploy' }));
  const dialog = await screen.findByRole('dialog');
  return { user, dialog };
}

it('compares an older commit with the live one and cancels without deploying', async () => {
  render(<RedeployControl />);
  const { user, dialog } = await openDialog();

  expect(
    within(dialog).getByRole('heading', { name: 'Redeploy an older commit?' }),
  ).toBeInTheDocument();
  expect(
    within(dialog).getByText("This isn't the last successful deployment."),
  ).toBeInTheDocument();
  expect(within(dialog).getByText('Live now')).toBeInTheDocument();
  expect(within(dialog).getByText('Live commit')).toBeInTheDocument();
  expect(within(dialog).getByText('Will deploy')).toBeInTheDocument();
  expect(within(dialog).getByText('Target commit')).toBeInTheDocument();
  expect(
    within(dialog).getByText('Database migrations are not rolled back.'),
  ).toBeInTheDocument();
  expect(
    within(dialog).getByRole('link', { name: /Compare changes on GitHub/ }),
  ).toHaveAttribute(
    'href',
    `https://github.com/${mockApplication.githubRepository?.fullName}/compare/${target.commitSHA}...${live.commitSHA}`,
  );

  const cancel = within(dialog).getByRole('button', { name: 'Cancel' });
  expect(cancel).toHaveFocus();
  await user.click(cancel);
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
  expect(requests).toHaveLength(0);
});

it.each([
  {
    name: 'a newer failed commit',
    status: 'failed',
    createdAt: '2026-10-21T12:00:00Z',
    title: 'Redeploy a failed commit?',
    statusText: /^Failed ·/,
    compareLinks: 0,
  },
  {
    name: 'a newer failed legacy deployment',
    status: 'FAILED',
    createdAt: '2026-10-21T12:00:00Z',
    title: 'Redeploy a failed commit?',
    statusText: /^Failed ·/,
    compareLinks: 0,
  },
  {
    name: 'a newer aborted commit',
    status: 'aborted',
    createdAt: '2026-10-21T12:00:00Z',
    title: 'Redeploy an aborted commit?',
    statusText: /^Aborted ·/,
    compareLinks: 0,
  },
  {
    name: 'an older failed commit',
    status: 'failed',
    createdAt: target.createdAt,
    title: 'Redeploy an older commit?',
    statusText: /^Failed ·/,
    compareLinks: 1,
  },
  {
    name: 'a different commit created at the same time',
    status: 'succeeded',
    createdAt: live.createdAt,
    title: 'Redeploy a different commit?',
    statusText: /^Deployed ·/,
    compareLinks: 1,
  },
])(
  'warns about $name',
  async ({ status, createdAt, title, statusText, compareLinks }) => {
    render(<RedeployControl deployment={{ ...target, status, createdAt }} />);
    const { dialog } = await openDialog();

    expect(
      within(dialog).getByRole('heading', { name: title }),
    ).toBeInTheDocument();
    expect(within(dialog).getAllByText(statusText).length).toBeGreaterThan(0);
    expect(
      within(dialog).queryAllByRole('link', {
        name: /Compare changes on GitHub/,
      }),
    ).toHaveLength(compareLinks);
    expect(
      within(dialog).getByRole('button', { name: 'Redeploy' }),
    ).toBeEnabled();
  },
);

it('schedules the target commit and closes after confirming', async () => {
  render(<RedeployControl />);
  const { user, dialog } = await openDialog();
  await user.click(within(dialog).getByRole('button', { name: 'Redeploy' }));

  await waitFor(() => expect(requests).toHaveLength(1));
  expect(requests[0].object.input).toEqual({
    name: 'nhost-backend-build',
    app_id: mockApplication.id,
    commit_sha: target.commitSHA,
    commit_message: target.commitMessage,
    commit_user_name: target.commitUserName,
    commit_user_avatar_url: target.commitUserAvatarUrl,
  });
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
});

it('stays open after a failed insert so the user can retry', async () => {
  server.use(
    graphql.mutation(
      'InsertPipelineRun',
      () => HttpResponse.json({ errors: [{ message: 'Scheduling failed' }] }),
      { once: true },
    ),
  );
  render(<RedeployControl />);
  const { user, dialog } = await openDialog();
  await user.click(within(dialog).getByRole('button', { name: 'Redeploy' }));

  expect(await screen.findByText('Scheduling failed')).toBeInTheDocument();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  await waitFor(() =>
    expect(
      within(dialog).getByRole('button', { name: 'Redeploy' }),
    ).toBeEnabled(),
  );
  await user.click(within(dialog).getByRole('button', { name: 'Redeploy' }));
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
  expect(requests).toHaveLength(1);
});

it('disables Redeploy when a deployment starts while the dialog is open', async () => {
  const { rerender } = render(<RedeployControl />);
  const { dialog } = await openDialog();
  rerender(<RedeployControl inProgress />);

  expect(
    within(dialog).getByRole('button', { name: 'Redeploy' }),
  ).toBeDisabled();
  expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeEnabled();
});

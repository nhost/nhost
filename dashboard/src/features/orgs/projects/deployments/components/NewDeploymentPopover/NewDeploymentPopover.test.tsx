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
  mockSession,
} from '@/tests/mocks';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import {
  queryClient,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import NewDeploymentPopover from './NewDeploymentPopover';

vi.mock('next/router', () => ({
  useRouter: () => ({
    query: { orgSlug: 'xyz', appSubdomain: 'test-project' },
    isReady: true,
  }),
}));

const running: UnifiedDeploymentRowFragment = {
  id: 'running',
  appId: mockApplication.id,
  source: 'pipeline_run',
  commitSHA: 'a'.repeat(40),
  commitMessage: 'Running commit',
  commitUserName: 'Alice',
  commitUserAvatarUrl: null,
  status: 'running',
  createdAt: '2026-10-20T12:00:00Z',
  startedAt: '2026-10-20T12:01:00Z',
  endedAt: null,
};
const refLabel = 'Branch, tag or commit SHA';
const requests: InsertPipelineRunMutationVariables[] = [];
const server = setupServer(tokenQuery);

function serve({
  pending = [],
  insertFails = false,
}: {
  pending?: UnifiedDeploymentRowFragment[];
  insertFails?: boolean;
} = {}) {
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
          case 'PendingOrRunningUnifiedDeploymentsSub':
            return HttpResponse.json({
              data: { unifiedDeployments: pending },
            });
          case 'InsertPipelineRun':
            if (insertFails) {
              return HttpResponse.json({
                errors: [{ message: 'Scheduling failed' }],
              });
            }
            requests.push(variables);
            return HttpResponse.json({
              data: {
                insertPipelineRun: {
                  id: 'new',
                  name: 'nhost-backend-build',
                  status: 'pending',
                  appId: mockApplication.id,
                  input: variables.object.input,
                  createdAt: running.createdAt,
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

async function openPopover() {
  const user = new TestUserEvent();
  await user.click(screen.getByRole('button', { name: /New deployment/ }));
  await screen.findByRole('dialog');
  return user;
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

it('warns about migrations and deploys the ref as the signed-in user', async () => {
  serve();
  render(<NewDeploymentPopover />);
  const user = await openPopover();

  expect(
    screen.getByText('Database migrations are not rolled back.'),
  ).toBeVisible();
  await user.type(
    screen.getByRole('textbox', { name: refLabel }),
    ' feat/comments ',
  );
  await user.type(
    screen.getByRole('textbox', { name: 'Commit message' }),
    'Roll back the comments table',
  );
  await user.click(screen.getByRole('button', { name: 'Deploy' }));

  await waitFor(() => expect(requests).toHaveLength(1));
  expect(requests[0].object.input).toEqual({
    name: 'nhost-backend-build',
    app_id: mockApplication.id,
    commit_sha: 'feat/comments',
    commit_message: 'Roll back the comments table',
    commit_user_name: mockSession.user?.displayName,
    commit_user_avatar_url: mockSession.user?.avatarUrl,
  });
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
});

it.each([
  {
    name: 'without a ref',
    fields: [['Commit message', 'Fix comments']],
    error: 'Enter a branch, tag or commit SHA.',
  },
  {
    name: 'with spaces in the ref',
    fields: [
      [refLabel, 'two words'],
      ['Commit message', 'Fix comments'],
    ],
    error: "A ref can't contain spaces.",
  },
  {
    name: 'with a blank commit message',
    fields: [
      [refLabel, 'main'],
      ['Commit message', '   '],
    ],
    error: 'Enter a commit message.',
  },
])('does not deploy $name', async ({ fields, error }) => {
  serve();
  render(<NewDeploymentPopover />);
  const user = await openPopover();

  for (const [label, value] of fields) {
    await user.type(screen.getByRole('textbox', { name: label }), value);
  }
  await user.click(screen.getByRole('button', { name: 'Deploy' }));

  expect(await screen.findByText(error)).toBeVisible();
  expect(requests).toEqual([]);
});

it('stays open with the values entered when scheduling fails', async () => {
  serve({ insertFails: true });
  render(<NewDeploymentPopover />);
  const user = await openPopover();

  await user.type(screen.getByRole('textbox', { name: refLabel }), 'main');
  await user.type(
    screen.getByRole('textbox', { name: 'Commit message' }),
    'Retry',
  );
  await user.click(screen.getByRole('button', { name: 'Deploy' }));

  expect(await screen.findByText('Scheduling failed')).toBeInTheDocument();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: refLabel })).toHaveValue('main');
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Deploy' })).toBeEnabled(),
  );
});

it('disables Deploy while a deployment is in progress', async () => {
  serve({ pending: [running] });
  render(<NewDeploymentPopover />);
  await openPopover();

  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Deploy' })).toBeDisabled(),
  );
  await waitFor(async () => {
    await userEvent.hover(
      screen.getByRole('button', { name: 'Deploy' }).parentElement as Element,
    );
    expect(screen.getByRole('tooltip')).toHaveTextContent(
      'Deployments cannot be re-triggered when a deployment is in progress.',
    );
  });
});

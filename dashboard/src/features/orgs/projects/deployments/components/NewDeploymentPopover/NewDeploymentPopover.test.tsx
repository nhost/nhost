import userEvent from '@testing-library/user-event';
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
  mockSession,
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
import NewDeploymentPopover from './NewDeploymentPopover';

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

// MSW has no handler for subscriptions, so this one picks it out by name and
// leaves every other operation to the next handlers.
function pendingDeployments(
  unifiedDeployments: UnifiedDeploymentRowFragment[],
) {
  return nhostGraphQLLink.operation(({ operationName }) => {
    if (operationName === 'PendingOrRunningUnifiedDeploymentsSub') {
      return HttpResponse.json({ data: { unifiedDeployments } });
    }
  });
}

const server = setupServer(
  getProjectQuery,
  getOrganization,
  getOrganizations,
  pendingDeployments([]),
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
            appId: mockApplication.id,
            input: variables.object.input,
            createdAt: running.createdAt,
            startedAt: null,
            endedAt: null,
          },
        },
      });
    },
  ),
);

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

it('does not deploy without a ref', async () => {
  render(<NewDeploymentPopover />);
  const user = await openPopover();

  await user.type(
    screen.getByRole('textbox', { name: 'Commit message' }),
    'Fix comments',
  );
  await user.click(screen.getByRole('button', { name: 'Deploy' }));

  expect(
    await screen.findByText('Enter a branch, tag or commit SHA.'),
  ).toBeVisible();
  expect(requests).toEqual([]);
});

it('does not deploy a ref with spaces', async () => {
  render(<NewDeploymentPopover />);
  const user = await openPopover();

  await user.type(screen.getByRole('textbox', { name: refLabel }), 'two words');
  await user.type(
    screen.getByRole('textbox', { name: 'Commit message' }),
    'Fix comments',
  );
  await user.click(screen.getByRole('button', { name: 'Deploy' }));

  expect(await screen.findByText("A ref can't contain spaces.")).toBeVisible();
  expect(requests).toEqual([]);
});

it('does not deploy with a blank commit message', async () => {
  render(<NewDeploymentPopover />);
  const user = await openPopover();

  await user.type(screen.getByRole('textbox', { name: refLabel }), 'main');
  await user.type(
    screen.getByRole('textbox', { name: 'Commit message' }),
    '   ',
  );
  await user.click(screen.getByRole('button', { name: 'Deploy' }));

  expect(await screen.findByText('Enter a commit message.')).toBeVisible();
  expect(requests).toEqual([]);
});

it('stays open with the values entered when scheduling fails', async () => {
  server.use(
    nhostGraphQLLink.mutation('InsertPipelineRun', () =>
      HttpResponse.json({ errors: [{ message: 'Scheduling failed' }] }),
    ),
  );
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
  server.use(pendingDeployments([running]));
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

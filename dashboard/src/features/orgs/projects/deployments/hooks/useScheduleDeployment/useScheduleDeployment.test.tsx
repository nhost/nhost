import { graphql, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { toast } from 'react-hot-toast';
import type { InsertPipelineRunMutationVariables } from '@/generated/graphql';
import { mockMatchMediaValue } from '@/tests/mocks';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import { act, Providers, queryClient, renderHook } from '@/tests/testUtils';
import useScheduleDeployment from './useScheduleDeployment';

const commit = {
  commitSHA: 'release/stored-ref',
  commitMessage: 'Stored commit',
  commitUserName: 'Alice',
  commitUserAvatarUrl: null,
};
const requests: InsertPipelineRunMutationVariables[] = [];
const server = setupServer(
  tokenQuery,
  graphql.mutation<Record<string, unknown>, InsertPipelineRunMutationVariables>(
    'InsertPipelineRun',
    ({ variables }) => {
      requests.push(variables);
      return HttpResponse.json({
        data: {
          insertPipelineRun: {
            id: 'new',
            name: 'nhost-backend-build',
            status: 'pending',
            input: variables.object.input,
            appId: 'test-app-id',
            createdAt: '2026-10-21T12:00:00Z',
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
  server.listen({ onUnhandledRequest: 'error' });
});
beforeEach(() => {
  process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'false';
  requests.length = 0;
});
afterEach(() => {
  server.resetHandlers();
  queryClient.clear();
  toast.remove();
});
afterAll(() => server.close());

it('sends stored refs unchanged and ignores a second call while scheduling', async () => {
  const { result } = renderHook(() => useScheduleDeployment(), {
    wrapper: Providers,
  });
  let success: boolean | undefined;
  let duplicate: boolean | undefined;
  await act(async () => {
    const first = result.current.schedule(commit);
    duplicate = await result.current.schedule(commit);
    success = await first;
  });
  expect(success).toBe(true);
  expect(duplicate).toBe(false);
  expect(requests).toHaveLength(1);
  expect(requests[0].object.input).toMatchObject({
    name: 'nhost-backend-build',
    commit_sha: commit.commitSHA,
    commit_message: commit.commitMessage,
    commit_user_name: commit.commitUserName,
    commit_user_avatar_url: null,
  });
});

it('returns false on insert failure and accepts a later retry', async () => {
  server.use(
    graphql.mutation(
      'InsertPipelineRun',
      () => HttpResponse.json({ errors: [{ message: 'Scheduling failed' }] }),
      { once: true },
    ),
  );
  const { result } = renderHook(() => useScheduleDeployment(), {
    wrapper: Providers,
  });
  let failed: boolean | undefined;
  let retried: boolean | undefined;
  await act(async () => {
    failed = await result.current.schedule(commit);
  });
  await act(async () => {
    retried = await result.current.schedule(commit);
  });
  expect(failed).toBe(false);
  expect(retried).toBe(true);
  expect(requests).toHaveLength(1);
});

import { QueryClientProvider } from '@tanstack/react-query';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { PropsWithChildren } from 'react';
import {
  getSuggestRelationshipsQueryKey,
  useSuggestRelationshipsQuery,
} from '@/features/orgs/projects/database/dataGrid/hooks/useSuggestRelationshipsQuery';
import { queryClient, renderHook, waitFor } from '@/tests/testUtils';

const HASURA = 'https://local.hasura.local.nhost.run';

const project = {
  subdomain: 'test-app',
  region: { name: 'us-east-1', domain: 'nhost.run' },
  config: { hasura: { adminSecret: 'test-secret' } },
};

const mocks = vi.hoisted(() => ({
  useProject: vi.fn(),
}));

vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: mocks.useProject,
}));

const suggestionsResponse = {
  relationships: [
    {
      type: 'object',
      from: {
        table: { schema: 'public', name: 'books' },
        columns: ['author_id'],
      },
      to: { table: { schema: 'public', name: 'authors' }, columns: ['id'] },
    },
  ],
};

let requestBody: unknown = null;

const server = setupServer(
  http.post(`${HASURA}/v1/metadata`, async ({ request }) => {
    requestBody = await request.json();
    return HttpResponse.json(suggestionsResponse);
  }),
);

function wrapper({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useSuggestRelationshipsQuery', () => {
  beforeAll(() => server.listen());

  beforeEach(() => {
    requestBody = null;
    queryClient.clear();
    mocks.useProject.mockReturnValue({ project, loading: false });
  });

  afterEach(() => server.resetHandlers());

  afterAll(() => server.close());

  it('caches table suggestions per project, source, and table', async () => {
    const table = { schema: 'public', name: 'books' };
    const queryKey = getSuggestRelationshipsQueryKey(
      project.subdomain,
      'default',
      table,
    );
    const { result } = renderHook(
      () => useSuggestRelationshipsQuery(undefined, table),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryKey).toEqual([
      'suggest-relationships',
      project.subdomain,
      'default',
      table,
    ]);
    expect(requestBody).toEqual({
      type: 'pg_suggest_relationships',
      args: { source: 'default', tables: [table], omit_tracked: false },
    });
    expect(queryClient.getQueryData(queryKey)).toEqual(suggestionsResponse);
  });
});

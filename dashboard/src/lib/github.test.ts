import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import {
  compareGitHubCommits,
  GitHubAPIError,
  getGitHubCommit,
  getGitHubRepository,
  listGitHubAppInstallations,
  listGitHubBranchCommits,
  listGitHubInstallationRepos,
  listGitHubMatchingRefs,
} from './github';

const github = 'https://api.github.com';
const server = setupServer();
const requests: { url: string; authorization: string | null }[] = [];
const sha = 'a'.repeat(40);
const commit = {
  sha,
  commit: {
    message: 'Commit subject\n\nDescription',
    author: { name: 'Commit Author', date: '2026-10-21T12:00:00Z' },
    committer: { name: 'Committer', date: '2026-10-21T13:00:00Z' },
  },
  author: { login: 'github-author', avatar_url: `${github}/avatar.png` },
  committer: null,
};
const mappedCommit = {
  sha,
  message: commit.commit.message,
  authorName: 'github-author',
  avatarUrl: `${github}/avatar.png`,
  date: commit.commit.author.date,
};

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  requests.length = 0;
  server.use(
    http.get(`${github}/*`, ({ request }) => {
      requests.push({
        url: request.url,
        authorization: request.headers.get('authorization'),
      });
      return undefined;
    }),
  );
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

it('follows every page of installations', async () => {
  const page1 = Array.from({ length: 100 }, (_, index) => ({ id: index + 1 }));
  const page2 = [{ id: 101 }];
  const pages: string[] = [];
  server.use(
    http.get(`${github}/user/installations`, ({ request }) => {
      const page = new URL(request.url).searchParams.get('page') ?? '1';
      pages.push(page);
      return HttpResponse.json(
        { installations: page === '1' ? page1 : page2 },
        {
          headers:
            page === '1'
              ? {
                  link: `<${github}/user/installations?per_page=100&page=2>; rel="next"`,
                }
              : {},
        },
      );
    }),
  );
  expect(await listGitHubAppInstallations('token')).toEqual([
    ...page1,
    ...page2,
  ]);
  expect(pages).toEqual(['1', '2']);
});

it('follows every page of installation repositories', async () => {
  const installation = {
    id: 7,
    account: { login: 'fixture-org', avatar_url: '' },
  };
  const pages: string[] = [];
  const repos: Record<string, { id: number }[]> = {
    '1': [{ id: 1 }],
    '2': [{ id: 2 }],
    '3': [{ id: 3 }],
  };
  server.use(
    http.get(`${github}/user/installations`, () =>
      HttpResponse.json({ installations: [installation] }),
    ),
    http.get(`${github}/user/installations/7/repositories`, ({ request }) => {
      const page = new URL(request.url).searchParams.get('page') ?? '1';
      pages.push(page);
      return HttpResponse.json(
        { repositories: repos[page] },
        {
          headers:
            page !== '3'
              ? {
                  link: `<${github}/user/installations/7/repositories?per_page=100&page=${Number(page) + 1}>; rel="next"`,
                }
              : {},
        },
      );
    }),
  );
  expect(await listGitHubInstallationRepos('token')).toEqual([
    { installation, repositories: [{ id: 1 }, { id: 2 }, { id: 3 }] },
  ]);
  expect(pages).toEqual(['1', '2', '3']);
});

it('does not send a token to a non-GitHub pagination URL', async () => {
  server.use(
    http.get(`${github}/user/installations`, () =>
      HttpResponse.json(
        { installations: [] },
        { headers: { link: '<https://example.com/next>; rel="next"' } },
      ),
    ),
  );
  await expect(listGitHubAppInstallations('token')).rejects.toMatchObject({
    name: 'GitHubAPIError',
    status: 0,
  });
});

it('checks repository access with authenticated GitHub headers', async () => {
  const repository = { id: 1, name: 'repo', full_name: 'fixture/repo' };
  server.use(
    http.get(`${github}/repos/fixture/repo`, ({ request }) => {
      requests.push({
        url: request.url,
        authorization: request.headers.get('authorization'),
      });
      expect(request.headers.get('accept')).toBe('application/vnd.github+json');
      expect(request.headers.get('x-github-api-version')).toBe('2022-11-28');
      return HttpResponse.json(repository);
    }),
  );
  expect(await getGitHubRepository('token', 'fixture/repo')).toEqual(
    repository,
  );
  expect(requests).toEqual([
    { url: `${github}/repos/fixture/repo`, authorization: 'Bearer token' },
  ]);
});

it.each([
  { ref: 'abcdef0', path: 'abcdef0' },
  { ref: 'refs/heads/feat/slash', path: 'refs/heads/feat/slash' },
  { ref: 'refs/tags/release/v1', path: 'refs/tags/release/v1' },
  { ref: 'feat/a#b?c%', path: 'feat/a%23b%3Fc%25' },
])(
  'resolves $ref through the commits endpoint to a full commit SHA',
  async ({ ref, path }) => {
    server.use(
      http.get(`${github}/repos/fixture/repo/commits/*`, ({ request }) => {
        requests.push({
          url: request.url,
          authorization: request.headers.get('authorization'),
        });
        return HttpResponse.json(commit);
      }),
    );
    expect(await getGitHubCommit('token', 'fixture/repo', ref)).toEqual(
      mappedCommit,
    );
    expect(requests).toEqual([
      {
        url: `${github}/repos/fixture/repo/commits/${path}`,
        authorization: 'Bearer token',
      },
    ]);
  },
);

it.each([
  {
    name: 'commit author fallback',
    author: null,
    commitAuthor: commit.commit.author,
    expectedName: 'Commit Author',
    expectedDate: commit.commit.author.date,
  },
  {
    name: 'committer fallback',
    author: null,
    commitAuthor: null,
    expectedName: 'Committer',
    expectedDate: commit.commit.committer.date,
  },
])(
  'uses $name when the GitHub account is absent',
  async ({ author, commitAuthor, expectedName, expectedDate }) => {
    server.use(
      http.get(`${github}/repos/fixture/repo/commits/*`, () =>
        HttpResponse.json({
          ...commit,
          author,
          commit: { ...commit.commit, author: commitAuthor },
        }),
      ),
    );
    expect(
      await getGitHubCommit('token', 'fixture/repo', 'main'),
    ).toMatchObject({
      authorName: expectedName,
      avatarUrl: null,
      date: expectedDate,
    });
  },
);

it.each([
  {
    kind: 'heads' as const,
    prefix: 'feat',
    encoded: 'feat',
    name: 'feat/slash',
  },
  {
    kind: 'heads' as const,
    prefix: 'feat/',
    encoded: 'feat/',
    name: 'feat/slash',
  },
  {
    kind: 'tags' as const,
    prefix: 'release/v',
    encoded: 'release/v',
    name: 'release/v1',
  },
  {
    kind: 'heads' as const,
    prefix: 'feat/a#',
    encoded: 'feat/a%23',
    name: 'feat/a#b',
  },
])(
  'lists $kind matching $prefix without exposing object SHAs',
  async ({ kind, prefix, encoded, name }) => {
    const qualifiedRef = `refs/${kind}/${name}`;
    server.use(
      http.get(
        `${github}/repos/fixture/repo/git/matching-refs/*`,
        ({ request }) => {
          requests.push({
            url: request.url,
            authorization: request.headers.get('authorization'),
          });
          return HttpResponse.json([
            {
              ref: qualifiedRef,
              object: { type: 'tag', sha: 'tag-object-sha' },
            },
          ]);
        },
      ),
    );
    expect(
      await listGitHubMatchingRefs('token', 'fixture/repo', kind, prefix),
    ).toEqual([{ name, qualifiedRef }]);
    expect(requests[0].url).toBe(
      `${github}/repos/fixture/repo/git/matching-refs/${kind}/${encoded}`,
    );
  },
);

it('rejects an empty matching-ref prefix without requesting GitHub', async () => {
  await expect(
    listGitHubMatchingRefs('token', 'fixture/repo', 'heads', ''),
  ).rejects.toMatchObject({ name: 'GitHubAPIError', status: 422 });
  expect(requests).toEqual([]);
});

it('resolves an annotated tag through commits, not its tag-object SHA', async () => {
  server.use(
    http.get(
      `${github}/repos/fixture/repo/git/matching-refs/tags/release`,
      () =>
        HttpResponse.json([
          {
            ref: 'refs/tags/release',
            object: { type: 'tag', sha: 'b'.repeat(40) },
          },
        ]),
    ),
    http.get(`${github}/repos/fixture/repo/commits/refs/tags/release`, () =>
      HttpResponse.json(commit),
    ),
  );
  const [tag] = await listGitHubMatchingRefs(
    'token',
    'fixture/repo',
    'tags',
    'release',
  );
  expect(
    await getGitHubCommit('token', 'fixture/repo', tag.qualifiedRef),
  ).toEqual(mappedCommit);
  expect(tag).toEqual({ name: 'release', qualifiedRef: 'refs/tags/release' });
});

it('gets exactly the latest 100 branch commits with slash names in the sha parameter', async () => {
  server.use(
    http.get(`${github}/repos/fixture/repo/commits`, ({ request }) => {
      requests.push({
        url: request.url,
        authorization: request.headers.get('authorization'),
      });
      return HttpResponse.json([commit]);
    }),
  );
  expect(
    await listGitHubBranchCommits('token', 'fixture/repo', 'feat/slash'),
  ).toEqual([mappedCommit]);
  expect(requests[0].url).toBe(
    `${github}/repos/fixture/repo/commits?sha=feat%2Fslash&per_page=100`,
  );
});

it('maps comparison counts and encodes refs segment by segment with per_page=1', async () => {
  server.use(
    http.get(`${github}/repos/fixture/repo/compare/*`, ({ request }) => {
      requests.push({
        url: request.url,
        authorization: request.headers.get('authorization'),
      });
      return HttpResponse.json({
        status: 'diverged',
        ahead_by: 3,
        behind_by: 2,
      });
    }),
  );
  expect(
    await compareGitHubCommits(
      'token',
      'fixture/repo',
      'refs/heads/main',
      'feat/a#b',
    ),
  ).toEqual({ status: 'diverged', aheadBy: 3, behindBy: 2 });
  expect(requests[0].url).toBe(
    `${github}/repos/fixture/repo/compare/refs/heads/main...feat/a%23b?per_page=1`,
  );
});

it.each<{
  status: number;
  headers: Record<string, string>;
  message: string;
  rateLimited: boolean;
}>([
  { status: 401, headers: {}, message: 'Bad credentials', rateLimited: false },
  { status: 404, headers: {}, message: 'Not Found', rateLimited: false },
  { status: 422, headers: {}, message: 'Invalid ref', rateLimited: false },
  { status: 403, headers: {}, message: 'Forbidden', rateLimited: false },
  {
    status: 403,
    headers: { 'x-ratelimit-remaining': '0' },
    message: 'Forbidden',
    rateLimited: true,
  },
  {
    status: 403,
    headers: { 'retry-after': '60' },
    message: 'Forbidden',
    rateLimited: true,
  },
  {
    status: 403,
    headers: {},
    message: 'API rate limit exceeded',
    rateLimited: true,
  },
  {
    status: 403,
    headers: {},
    message: 'You have exceeded a secondary rate limit',
    rateLimited: true,
  },
  { status: 429, headers: {}, message: 'Too many requests', rateLimited: true },
])(
  'classifies $status $message with $headers as rateLimited=$rateLimited',
  async ({ status, headers, message, rateLimited }) => {
    server.use(
      http.get(`${github}/repos/fixture/repo/commits/*`, () =>
        HttpResponse.json({ message }, { status, headers }),
      ),
    );
    await expect(
      getGitHubCommit('token', 'fixture/repo', 'main'),
    ).rejects.toMatchObject({
      name: 'GitHubAPIError',
      status,
      rateLimited,
      message: `GitHub request failed: ${message}`,
    });
  },
);

it.each([
  {
    name: 'repository',
    call: (signal?: AbortSignal) =>
      getGitHubRepository('token', 'fixture/repo', signal),
  },
  {
    name: 'commit',
    call: (signal?: AbortSignal) =>
      getGitHubCommit('token', 'fixture/repo', 'main', signal),
  },
  {
    name: 'refs',
    call: (signal?: AbortSignal) =>
      listGitHubMatchingRefs('token', 'fixture/repo', 'heads', 'feat', signal),
  },
  {
    name: 'branch commits',
    call: (signal?: AbortSignal) =>
      listGitHubBranchCommits('token', 'fixture/repo', 'main', signal),
  },
  {
    name: 'compare',
    call: (signal?: AbortSignal) =>
      compareGitHubCommits('token', 'fixture/repo', 'base', 'head', signal),
  },
  {
    name: 'installations',
    call: (signal?: AbortSignal) =>
      listGitHubInstallationRepos('token', signal),
  },
])(
  '$name preserves HTTP error status and accepts cancellation',
  async ({ call }) => {
    server.use(
      http.get(`${github}/*`, () =>
        HttpResponse.json({ message: 'Not found' }, { status: 404 }),
      ),
    );
    await expect(call()).rejects.toBeInstanceOf(GitHubAPIError);
    await expect(call()).rejects.toMatchObject({
      status: 404,
      rateLimited: false,
    });
    const controller = new AbortController();
    controller.abort();
    await expect(call(controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
  },
);

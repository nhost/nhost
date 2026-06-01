import { vi } from 'vitest';
import {
  GitHubAPIError,
  listGitHubAppInstallations,
  listGitHubInstallationRepos,
} from './github';

function mockResponse(
  body: unknown,
  init?: { ok?: boolean; status?: number; statusText?: string; link?: string },
) {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: init?.statusText ?? 'OK',
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'link' ? (init?.link ?? null) : null,
    },
    json: async () => body,
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('listGitHubAppInstallations', () => {
  it('follows the Link header to fetch every page of installations', async () => {
    const page1 = Array.from({ length: 100 }, (_, index) => ({
      id: index + 1,
      account: { login: `org-${index + 1}`, avatar_url: '' },
    }));
    const page2 = [{ id: 101, account: { login: 'org-101', avatar_url: '' } }];

    const fetchMock = vi.fn((url: string) => {
      if (url === 'https://api.github.com/user/installations?per_page=100') {
        return Promise.resolve(
          mockResponse(
            { installations: page1 },
            {
              link: '<https://api.github.com/user/installations?per_page=100&page=2>; rel="next"',
            },
          ),
        );
      }

      return Promise.resolve(mockResponse({ installations: page2 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    await listGitHubAppInstallations('token');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.github.com/user/installations?per_page=100',
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://api.github.com/user/installations?per_page=100&page=2',
    );
  });
});

describe('listGitHubInstallationRepos', () => {
  it('follows the Link header to fetch every page of an installation’s repositories', async () => {
    const installations = [
      { id: 7, account: { login: 'acme', avatar_url: '' } },
    ];
    const repositoriesByPage: Record<string, unknown[]> = {
      '1': Array.from({ length: 100 }, (_, index) => ({ id: index + 1 })),
      '2': Array.from({ length: 100 }, (_, index) => ({ id: index + 101 })),
      '3': Array.from({ length: 50 }, (_, index) => ({ id: index + 201 })),
    };
    const repoLinkByPage: Record<string, string | undefined> = {
      '1': '<https://api.github.com/user/installations/7/repositories?per_page=100&page=2>; rel="next"',
      '2': '<https://api.github.com/user/installations/7/repositories?per_page=100&page=3>; rel="next"',
      '3': undefined,
    };

    const fetchMock = vi.fn((url: string) => {
      const parsed = new URL(url);

      if (parsed.pathname === '/user/installations') {
        return Promise.resolve(mockResponse({ installations }));
      }

      const page = parsed.searchParams.get('page') ?? '1';

      return Promise.resolve(
        mockResponse(
          { repositories: repositoriesByPage[page] },
          { link: repoLinkByPage[page] },
        ),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await listGitHubInstallationRepos('token');

    expect(result[0].repositories.map((repo) => repo.id)).toEqual(
      Array.from({ length: 250 }, (_, index) => index + 1),
    );
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('throws a GitHubAPIError when a repos request fails', async () => {
    const installations = [
      { id: 1, account: { login: 'acme', avatar_url: '' } },
    ];

    const fetchMock = vi.fn((url: string) => {
      if (new URL(url).pathname === '/user/installations') {
        return Promise.resolve(mockResponse({ installations }));
      }

      return Promise.resolve(
        mockResponse(null, { ok: false, status: 403, statusText: 'Forbidden' }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(listGitHubInstallationRepos('token')).rejects.toBeInstanceOf(
      GitHubAPIError,
    );
  });
});

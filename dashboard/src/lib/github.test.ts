import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GitHubAPIError,
  listGitHubAppInstallations,
  listGitHubInstallationRepos,
} from './github';

function mockResponse(
  body: unknown,
  init?: { ok?: boolean; status?: number; statusText?: string },
) {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: init?.statusText ?? 'OK',
    json: async () => body,
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('listGitHubAppInstallations', () => {
  it('fetches every page of installations', async () => {
    const page1 = Array.from({ length: 100 }, (_, index) => ({
      id: index + 1,
      account: { login: `org-${index + 1}`, avatar_url: '' },
    }));
    const page2 = [{ id: 101, account: { login: 'org-101', avatar_url: '' } }];
    const installationsByPage: Record<string, unknown> = {
      '1': { total_count: 101, installations: page1 },
      '2': { total_count: 101, installations: page2 },
    };

    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(
        mockResponse(
          installationsByPage[new URL(url).searchParams.get('page') as string],
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const installations = await listGitHubAppInstallations('token');

    expect(installations).toHaveLength(101);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.github.com/user/installations?per_page=100&page=1',
    );
  });
});

describe('listGitHubInstallationRepos', () => {
  it('makes a single repos request per installation when one page is enough', async () => {
    const installations = [
      { id: 1, account: { login: 'acme', avatar_url: '' } },
    ];

    const fetchMock = vi.fn((url: string) => {
      const { pathname } = new URL(url);

      if (pathname === '/user/installations') {
        return Promise.resolve(mockResponse({ total_count: 1, installations }));
      }

      return Promise.resolve(
        mockResponse({ total_count: 2, repositories: [{ id: 1 }, { id: 2 }] }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await listGitHubInstallationRepos('token');

    expect(result).toHaveLength(1);
    expect(result[0].repositories).toHaveLength(2);
    // one installations request + one repos request
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('fetches every page of an installation’s repositories', async () => {
    const installations = [
      { id: 7, account: { login: 'acme', avatar_url: '' } },
    ];
    const repositoriesByPage: Record<string, unknown[]> = {
      '1': Array.from({ length: 100 }, (_, index) => ({ id: index + 1 })),
      '2': Array.from({ length: 100 }, (_, index) => ({ id: index + 101 })),
      '3': Array.from({ length: 50 }, (_, index) => ({ id: index + 201 })),
    };

    const fetchMock = vi.fn((url: string) => {
      const parsed = new URL(url);

      if (parsed.pathname === '/user/installations') {
        return Promise.resolve(mockResponse({ total_count: 1, installations }));
      }

      return Promise.resolve(
        mockResponse({
          total_count: 250,
          repositories:
            repositoriesByPage[parsed.searchParams.get('page') as string],
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await listGitHubInstallationRepos('token');

    expect(result[0].repositories).toHaveLength(250);
    expect(result[0].repositories.map((repo) => repo.id)).toEqual(
      Array.from({ length: 250 }, (_, index) => index + 1),
    );
    // one installations request + three repos pages
    expect(fetchMock).toHaveBeenCalledTimes(4);

    const repoCalls = fetchMock.mock.calls.filter(([requestUrl]) =>
      (requestUrl as string).includes('/repositories'),
    );
    expect(repoCalls).toHaveLength(3);
    for (const [requestUrl] of repoCalls) {
      expect(requestUrl).toContain('per_page=100');
    }
  });

  it('throws a GitHubAPIError with the status code when a repos request fails', async () => {
    const installations = [
      { id: 1, account: { login: 'acme', avatar_url: '' } },
    ];

    const fetchMock = vi.fn((url: string) => {
      if (new URL(url).pathname === '/user/installations') {
        return Promise.resolve(mockResponse({ total_count: 1, installations }));
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

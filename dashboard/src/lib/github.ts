/**
 * Custom error class for GitHub API errors that preserves HTTP status codes
 */
export class GitHubAPIError extends Error {
  constructor(
    message: string,
    public status: number,
    public statusText: string,
    public rateLimited = status === 429,
  ) {
    super(message);
    this.name = 'GitHubAPIError';
  }
}

interface GitHubAppInstallation {
  id: number;
  account?: {
    login: string;
    avatar_url: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface GitHubRepo {
  id: number;
  node_id: string;
  name: string;
  full_name: string;
  [key: string]: unknown;
}

const PER_PAGE = 100;

function githubHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

// Matches the next page URL inside a GitHub `Link` header, e.g.
// `<https://api.github.com/...?page=2>; rel="next"`.
const NEXT_PAGE_PATTERN = /(?<=<)\S*(?=>; rel="next")/i;

function getNextPageUrl(linkHeader: string | null): string | null {
  if (!linkHeader?.includes('rel="next"')) {
    return null;
  }

  return linkHeader.match(NEXT_PAGE_PATTERN)?.[0] ?? null;
}

/**
 * Fetches every page of a paginated GitHub list endpoint and returns the
 * concatenated items, following the `Link` response header until there is no
 * `rel="next"` page left.
 */
async function fetchAllPages<T>(
  accessToken: string,
  startUrl: string,
  dataKey: 'installations' | 'repositories',
  errorMessage: string,
  signal?: AbortSignal,
): Promise<T[]> {
  const items: T[] = [];
  let url: string | null = `${startUrl}?per_page=${PER_PAGE}`;

  while (url) {
    const { data, response } = await fetchGitHub<Record<string, unknown>>(
      accessToken,
      url,
      signal,
      errorMessage,
    );
    items.push(...((data[dataKey] as T[] | undefined) ?? []));

    url = getNextPageUrl(response.headers.get('link'));
  }

  return items;
}

/**
 * Lists all GitHub App installations accessible to the user, following the
 * `Link` header so installations beyond the first page are included.
 */
export async function listGitHubAppInstallations(
  accessToken: string,
  signal?: AbortSignal,
): Promise<GitHubAppInstallation[]> {
  return fetchAllPages<GitHubAppInstallation>(
    accessToken,
    'https://api.github.com/user/installations',
    'installations',
    'Failed to list installations',
    signal,
  );
}

/**
 * Lists all repositories accessible through GitHub App installations, following
 * the `Link` header so repositories beyond the first page are included.
 */
export async function listGitHubInstallationRepos(
  accessToken: string,
  signal?: AbortSignal,
) {
  const installations = await listGitHubAppInstallations(accessToken, signal);

  const reposByInstallation = await Promise.all(
    installations.map(async (installation) => {
      const repositories = await fetchAllPages<GitHubRepo>(
        accessToken,
        `https://api.github.com/user/installations/${installation.id}/repositories`,
        'repositories',
        `Failed to list repos for installation ${installation.id}`,
        signal,
      );

      return {
        installation,
        repositories,
      };
    }),
  );

  return reposByInstallation;
}

async function fetchGitHub<T>(
  accessToken: string,
  url: string,
  signal?: AbortSignal,
  errorMessage = 'GitHub request failed',
): Promise<{ data: T; response: Response }> {
  if (!url.startsWith('https://api.github.com/')) {
    throw new GitHubAPIError('Invalid GitHub API URL', 0, 'Invalid URL');
  }
  const response = await fetch(url, {
    headers: githubHeaders(accessToken),
    cache: 'no-cache',
    signal,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    const message = body?.message ?? response.statusText;
    const rateLimited =
      response.status === 429 ||
      (response.status === 403 &&
        (response.headers.get('x-ratelimit-remaining') === '0' ||
          response.headers.has('retry-after') ||
          /rate.?limit/i.test(message)));
    throw new GitHubAPIError(
      `${errorMessage}: ${message}`,
      response.status,
      response.statusText,
      rateLimited,
    );
  }
  return { data: (await response.json()) as T, response };
}

function encodeGitHubPath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

function repositoryUrl(fullName: string): string {
  return `https://api.github.com/repos/${encodeGitHubPath(fullName)}`;
}

export interface GitHubCommit {
  sha: string;
  message: string;
  authorName: string;
  avatarUrl: string | null;
  date: string | null;
}

interface GitHubCommitResponse {
  sha: string;
  commit: {
    message: string;
    author: { name: string; date: string } | null;
    committer: { name: string; date: string } | null;
  };
  author: { login: string; avatar_url: string } | null;
  committer: { login: string; avatar_url: string } | null;
}

function mapCommit(commit: GitHubCommitResponse): GitHubCommit {
  return {
    sha: commit.sha,
    message: commit.commit.message,
    authorName:
      commit.author?.login ??
      commit.commit.author?.name ??
      commit.commit.committer?.name ??
      '',
    avatarUrl:
      commit.author?.avatar_url ?? commit.committer?.avatar_url ?? null,
    date: commit.commit.author?.date ?? commit.commit.committer?.date ?? null,
  };
}

export async function getGitHubRepository(
  accessToken: string,
  fullName: string,
  signal?: AbortSignal,
): Promise<GitHubRepo> {
  const { data } = await fetchGitHub<GitHubRepo>(
    accessToken,
    repositoryUrl(fullName),
    signal,
  );
  return data;
}

export async function getGitHubCommit(
  accessToken: string,
  fullName: string,
  ref: string,
  signal?: AbortSignal,
): Promise<GitHubCommit> {
  const { data } = await fetchGitHub<GitHubCommitResponse>(
    accessToken,
    `${repositoryUrl(fullName)}/commits/${encodeGitHubPath(ref)}`,
    signal,
  );
  return mapCommit(data);
}

export interface GitHubMatchingRef {
  name: string;
  qualifiedRef: string;
}

export async function listGitHubMatchingRefs(
  accessToken: string,
  fullName: string,
  kind: 'heads' | 'tags',
  prefix: string,
  signal?: AbortSignal,
): Promise<GitHubMatchingRef[]> {
  if (!prefix) {
    throw new GitHubAPIError(
      'A ref prefix is required',
      422,
      'Unprocessable Entity',
    );
  }
  const { data } = await fetchGitHub<{ ref: string }[]>(
    accessToken,
    `${repositoryUrl(fullName)}/git/matching-refs/${kind}/${encodeGitHubPath(prefix)}`,
    signal,
  );
  return data.map((ref) => ({
    name: ref.ref.slice(`refs/${kind}/`.length),
    qualifiedRef: ref.ref,
  }));
}

export async function listGitHubBranchCommits(
  accessToken: string,
  fullName: string,
  branch: string,
  signal?: AbortSignal,
): Promise<GitHubCommit[]> {
  const params = new URLSearchParams({ sha: branch, per_page: '100' });
  const { data } = await fetchGitHub<GitHubCommitResponse[]>(
    accessToken,
    `${repositoryUrl(fullName)}/commits?${params}`,
    signal,
  );
  return data.map(mapCommit);
}

export interface GitHubComparison {
  status: 'ahead' | 'behind' | 'diverged' | 'identical';
  aheadBy: number;
  behindBy: number;
}

export async function compareGitHubCommits(
  accessToken: string,
  fullName: string,
  base: string,
  head: string,
  signal?: AbortSignal,
): Promise<GitHubComparison> {
  const { data } = await fetchGitHub<{
    status: GitHubComparison['status'];
    ahead_by: number;
    behind_by: number;
  }>(
    accessToken,
    `${repositoryUrl(fullName)}/compare/${encodeGitHubPath(base)}...${encodeGitHubPath(head)}?per_page=1`,
    signal,
  );
  return {
    status: data.status,
    aheadBy: data.ahead_by,
    behindBy: data.behind_by,
  };
}

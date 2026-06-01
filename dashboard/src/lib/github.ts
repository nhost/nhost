/**
 * Custom error class for GitHub API errors that preserves HTTP status codes
 */
export class GitHubAPIError extends Error {
  constructor(
    message: string,
    public status: number,
    public statusText: string,
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
): Promise<T[]> {
  const items: T[] = [];
  let url: string | null = `${startUrl}?per_page=${PER_PAGE}`;

  while (url) {
    const response = await fetch(url, {
      headers: githubHeaders(accessToken),
      cache: 'no-cache',
    });

    if (!response.ok) {
      throw new GitHubAPIError(
        `${errorMessage}: ${response.statusText}`,
        response.status,
        response.statusText,
      );
    }

    const data = (await response.json()) as Record<string, unknown>;
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
): Promise<GitHubAppInstallation[]> {
  return fetchAllPages<GitHubAppInstallation>(
    accessToken,
    'https://api.github.com/user/installations',
    'installations',
    'Failed to list installations',
  );
}

/**
 * Lists all repositories accessible through GitHub App installations, following
 * the `Link` header so repositories beyond the first page are included.
 */
export async function listGitHubInstallationRepos(accessToken: string) {
  const installations = await listGitHubAppInstallations(accessToken);

  const reposByInstallation = await Promise.all(
    installations.map(async (installation) => {
      const repositories = await fetchAllPages<GitHubRepo>(
        accessToken,
        `https://api.github.com/user/installations/${installation.id}/repositories`,
        'repositories',
        `Failed to list repos for installation ${installation.id}`,
      );

      return {
        installation,
        repositories,
      };
    }),
  );

  return reposByInstallation;
}

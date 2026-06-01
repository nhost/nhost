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

// GitHub's max page size. Using the max keeps the number of requests low.
const PER_PAGE = 100;

function githubHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

/**
 * Fetches every page of a paginated GitHub list endpoint and returns the
 * concatenated items.
 *
 * Both endpoints we use (`/user/installations` and
 * `/user/installations/{id}/repositories`) return a `total_count`, so we fetch
 * page 1 to learn the count and then request the remaining pages in parallel
 * instead of walking them sequentially.
 */
async function fetchAllPages<T>(
  accessToken: string,
  baseUrl: string,
  dataKey: 'installations' | 'repositories',
  errorMessage: string,
): Promise<T[]> {
  const fetchPage = async (
    page: number,
  ): Promise<{ totalCount: number; items: T[] }> => {
    const response = await fetch(
      `${baseUrl}?per_page=${PER_PAGE}&page=${page}`,
      {
        headers: githubHeaders(accessToken),
        cache: 'no-cache',
      },
    );

    if (!response.ok) {
      throw new GitHubAPIError(
        `${errorMessage}: ${response.statusText}`,
        response.status,
        response.statusText,
      );
    }

    const data = (await response.json()) as {
      total_count?: number;
      [key: string]: unknown;
    };

    return {
      totalCount: typeof data.total_count === 'number' ? data.total_count : 0,
      items: (data[dataKey] as T[] | undefined) ?? [],
    };
  };

  const firstPage = await fetchPage(1);
  const totalPages = Math.max(1, Math.ceil(firstPage.totalCount / PER_PAGE));

  if (totalPages <= 1) {
    return firstPage.items;
  }

  const remainingPages = Array.from(
    { length: totalPages - 1 },
    (_, index) => index + 2,
  );
  const restPages = await Promise.all(remainingPages.map(fetchPage));

  return [firstPage, ...restPages].flatMap((page) => page.items);
}

/**
 * Lists all GitHub App installations accessible to the user, following
 * pagination so installations beyond the first page are included.
 * @param accessToken - The GitHub OAuth access token
 * @returns Array of app installations
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
 * pagination so repositories beyond the first page are included.
 * @param accessToken - The GitHub OAuth access token
 * @returns Array of repositories grouped by installation
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

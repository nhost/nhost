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
  }
  [key: string]: unknown;
}

/**
 * Lists all GitHub App installations accessible to the user
 * @param accessToken - The GitHub OAuth access token
 * @returns Array of app installations
 */
export async function listGitHubAppInstallations(accessToken: string): Promise<GitHubAppInstallation[]> {
  const response = await fetch('https://api.github.com/user/installations', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    throw new GitHubAPIError(
      `Failed to list installations: ${response.statusText}`,
      response.status,
      response.statusText
    );
  }

  const data = await response.json();
  return data.installations;
}

interface  GitHubRepo {
  id: number;
  node_id: string;
  name: string;
  full_name: string;
  [key: string]: unknown;
}

/**
 * Lists all repositories accessible through GitHub App installations
 * @param accessToken - The GitHub OAuth access token
 * @returns Array of repositories grouped by installation
 */
export async function listGitHubInstallationRepos(accessToken: string) {
  const installations = await listGitHubAppInstallations(accessToken);

  const reposByInstallation = await Promise.all(
    installations.map(async (installation) => {
      const response = await fetch(
        `https://api.github.com/user/installations/${installation.id}/repositories`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        }
      );

      if (!response.ok) {
        throw new GitHubAPIError(
          `Failed to list repos for installation ${installation.id}: ${response.statusText}`,
          response.status,
          response.statusText
        );
      }

      const data = await response.json();
      return {
        installation,
        repositories: data.repositories as GitHubRepo[],
      };
    })
  );

  return reposByInstallation;
}

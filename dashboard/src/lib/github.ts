/**
 * Lists all GitHub App installations accessible to the user
 * @param accessToken - The GitHub OAuth access token
 * @returns Array of app installations
 */
export async function listGitHubAppInstallations(accessToken: string) {
  const response = await fetch('https://api.github.com/user/installations', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to list installations: ${response.statusText}`);
  }

  const data = await response.json();
  return data.installations;
}

/**
 * Lists all repositories accessible through GitHub App installations
 * @param accessToken - The GitHub OAuth access token
 * @returns Array of repositories grouped by installation
 */
export async function listGitHubInstallationRepos(accessToken: string) {
  const installations = await listGitHubAppInstallations(accessToken);

  const reposByInstallation = await Promise.all(
    installations.map(async (installation: any) => {
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
        throw new Error(
          `Failed to list repos for installation ${installation.id}: ${response.statusText}`
        );
      }

      const data = await response.json();
      return {
        installation,
        repositories: data.repositories,
      };
    })
  );

  return reposByInstallation;
}

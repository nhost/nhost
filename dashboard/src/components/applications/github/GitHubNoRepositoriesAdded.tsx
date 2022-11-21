import { Avatar } from '@/ui';
import { Button } from '@/ui/Button';
import { Text } from '@/ui/Text';
import { PlusSmIcon } from '@heroicons/react/solid';

export function GitHubNoRepositoriesAdded({
  filteredGitHubAppInstallations,
}: any) {
  return (
    <div>
      <Text
        variant="subHeading"
        color="greyscaleDark"
        size="large"
        className="mt-1 text-center"
      >
        No repositories found
      </Text>
      <Text
        variant="body"
        color="greyscaleDark"
        size="tiny"
        className="text-center font-normal"
      >
        Check the Nhost app&apos;s settings on your GitHub account, or install
        the app on a new account.
      </Text>

      <div className="my-2 border-t border-b py-3">
        <div className="flex">
          {filteredGitHubAppInstallations.map((githubApp) => (
            <div key={githubApp.id} className="mr-4 flex items-center">
              <Avatar
                avatarUrl={githubApp.accountAvatarUrl as string}
                className="mr-1 h-5 w-5"
              />
              {githubApp.accountLogin}
            </div>
          ))}
        </div>
      </div>
      <Button
        href={process.env.NEXT_PUBLIC_GITHUB_APP_INSTALL_URL}
        target="_blank"
        rel="noreferrer noopener"
        transparent
        type={null}
        className="cursor-pointer text-xs font-medium text-blue"
      >
        <PlusSmIcon className="mr-1 h-4 w-4 rounded-full border border-btn" />
        Configure the Nhost application on GitHub.
      </Button>
    </div>
  );
}

export default GitHubNoRepositoriesAdded;

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
        className="font-normal text-center"
      >
        Check the Nhost app&apos;s settings on your GitHub account, or install
        the app on a new account.
      </Text>

      <div className="py-3 my-2 border-t border-b">
        <div className="flex">
          {filteredGitHubAppInstallations.map((githubApp) => (
            <div key={githubApp.id} className="flex items-center mr-4">
              <Avatar
                avatarUrl={githubApp.accountAvatarUrl as string}
                className="w-5 h-5 mr-1"
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
        className="text-xs font-medium cursor-pointer text-blue"
      >
        <PlusSmIcon className="w-4 h-4 mr-1 border rounded-full border-btn" />
        Configure the Nhost application on GitHub.
      </Button>
    </div>
  );
}

export default GitHubNoRepositoriesAdded;

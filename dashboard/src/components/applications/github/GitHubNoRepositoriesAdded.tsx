import { Avatar } from '@/ui/Avatar';
import Divider from '@/ui/v2/Divider';
import PlusCircleIcon from '@/ui/v2/icons/PlusCircleIcon';
import Link from '@/ui/v2/Link';
import List from '@/ui/v2/List';
import { ListItem } from '@/ui/v2/ListItem';
import Text from '@/ui/v2/Text';
import { Fragment } from 'react';

export function GitHubNoRepositoriesAdded({
  filteredGitHubAppInstallations,
}: any) {
  return (
    <div>
      <Text className="mt-1 text-center text-lg font-medium">
        No repositories found
      </Text>

      <Text className="text-center text-xs">
        Check the Nhost app&apos;s settings on your GitHub account, or install
        the app on a new account.
      </Text>

      <List className="my-2 border-y">
        {filteredGitHubAppInstallations.map((githubApp, index) => (
          <Fragment key={githubApp.id}>
            <ListItem.Root
              key={githubApp.id}
              className="grid grid-flow-col gap-2 py-2.5 justify-start items-center"
            >
              <ListItem.Avatar>
                <Avatar
                  avatarUrl={githubApp.accountAvatarUrl as string}
                  className="mr-1 h-5 w-5"
                />
              </ListItem.Avatar>

              <ListItem.Text primary={githubApp.accountLogin} />
            </ListItem.Root>

            {index < filteredGitHubAppInstallations.length - 1 && (
              <Divider component="li" />
            )}
          </Fragment>
        ))}
      </List>

      <Link
        href={process.env.NEXT_PUBLIC_GITHUB_APP_INSTALL_URL}
        target="_blank"
        rel="noreferrer noopener"
        underline="hover"
        className="grid grid-flow-col gap-1 items-center justify-start"
      >
        <PlusCircleIcon className="w-4 h-4" />
        Configure the Nhost application on GitHub.
      </Link>
    </div>
  );
}

export default GitHubNoRepositoriesAdded;

import GithubIcon from '@/components/icons/GithubIcon';
import Button from '@/ui/v2/Button';
import ArrowSquareOutIcon from '@/ui/v2/icons/ArrowSquareOutIcon';
import Text from '@/ui/v2/Text';

export default function GitHubInstallNhostApplication() {
  return (
    <div className="grid grid-flow-row justify-center gap-2 p-0.5">
      <GithubIcon className="mx-auto h-8 w-8" />

      <div className="text-center">
        <Text variant="h3" component="h2">
          Install the Nhost GitHub Application
        </Text>

        <Text variant="subtitle2">
          Install the Nhost application on your GitHub account and update
          permissions to automatically track repositories.
        </Text>
      </div>

      <Button
        href={process.env.NEXT_PUBLIC_GITHUB_APP_INSTALL_URL}
        // Both `target` and `rel` are available when `href` is set. This is
        // a limitation of MUI.
        // @ts-ignore
        target="_blank"
        rel="noreferrer noopener"
        endIcon={<ArrowSquareOutIcon className="h-4 w-4" />}
      >
        Configure the Nhost application on GitHub
      </Button>
    </div>
  );
}

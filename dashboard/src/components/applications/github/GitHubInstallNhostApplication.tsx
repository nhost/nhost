import GithubIcon from '@/components/icons/GithubIcon';
import ArrowSquareOutIcon from '@/ui/v2/icons/ArrowSquareOutIcon';
import Link from '@/ui/v2/Link';
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

      <Link
        href={process.env.NEXT_PUBLIC_GITHUB_APP_INSTALL_URL}
        target="_blank"
        rel="noreferrer noopener"
        className="mt-2 grid grid-flow-col items-center justify-center gap-1 rounded-[4px] bg-btn p-2 text-sm+ font-medium text-white hover:ring-2 motion-safe:transition-all"
        underline="none"
      >
        Configure the Nhost application on GitHub{' '}
        <ArrowSquareOutIcon className="h-4 w-4" />
      </Link>
    </div>
  );
}

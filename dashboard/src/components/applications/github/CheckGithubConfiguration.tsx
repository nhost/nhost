import Link from '@/ui/v2/Link';
import Text from '@/ui/v2/Text';

export function CheckGithubConfiguration() {
  return (
    <Text className="mt-2 text-center text-xs">
      Do you miss a repository, or do you need to connect another GitHub
      account?{' '}
      <Link
        href={process.env.NEXT_PUBLIC_GITHUB_APP_INSTALL_URL}
        target="_blank"
        rel="noreferrer noopener"
        className="text-xs font-medium"
        underline="hover"
      >
        Manage your GitHub configuration
      </Link>
      .
    </Text>
  );
}

export default CheckGithubConfiguration;

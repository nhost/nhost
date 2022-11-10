import { Text } from '@/ui';

export function CheckGithubConfiguration() {
  return (
    <Text size="tiny" color="greyscaleDark" className="mt-2 text-center">
      Do you miss a repository, or do you need to connect another GitHub
      account?{' '}
      <a
        href={process.env.NEXT_PUBLIC_GITHUB_APP_INSTALL_URL}
        target="_blank"
        rel="noreferrer noopener"
        className="text-xs font-medium text-blue"
      >
        Manage your GitHub configuration
      </a>
      .
    </Text>
  );
}

export default CheckGithubConfiguration;

import { useMemo } from 'react';
import { NavLink } from '@/components/common/NavLink';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Box } from '@/components/ui/v2/Box';
import { GitHubIcon } from '@/components/ui/v2/icons/GitHubIcon';
import { Text } from '@/components/ui/v2/Text';
import { useAccessToken } from '@/hooks/useAccessToken';
import { useNhostClient } from '@/providers/nhost';
import { useGetAuthUserProvidersQuery } from '@/utils/__generated__/graphql';

export default function SocialProvidersSettings() {
  const nhost = useNhostClient();
  const token = useAccessToken();
  const { data, loading, error } = useGetAuthUserProvidersQuery();
  const isGithubConnected = data?.authUserProviders?.some(
    (item) => item.providerId === 'github',
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: singInProviderURL does not change
  const github = useMemo(() => {
    if (typeof window !== 'undefined') {
      return nhost.auth.signInProviderURL('github', {
        connect: token,
        redirectTo: `${window.location.origin}/account?signinProvider=github`,
      });
    }
    return '';
  }, [token]);

  if (!data && loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading personal access tokens..."
      />
    );
  }

  if (error) {
    throw error;
  }

  return (
    <SettingsContainer
      title="Authentication providers"
      description=""
      rootClassName="gap-0 flex flex-col items-start"
      className="my-2"
      slotProps={{
        submitButton: { className: 'hidden' },
        footer: { className: 'hidden' },
      }}
    >
      {isGithubConnected ? (
        <Box
          sx={{ backgroundColor: 'grey.200' }}
          className="flex flex-row items-center justify-start space-x-2 rounded-md p-2"
        >
          <GitHubIcon />
          <Text className="font-medium">Connected</Text>
        </Box>
      ) : (
        <Box>
          <NavLink
            variant="ghost"
            href={github}
            target="_blank"
            rel="noreferrer noopener"
          >
            <GitHubIcon />
            Connect with GitHub
          </NavLink>
        </Box>
      )}
    </SettingsContainer>
  );
}

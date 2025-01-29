import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { GitHubIcon } from '@/components/ui/v2/icons/GitHubIcon';
import { Text } from '@/components/ui/v2/Text';
import { useGetAuthUserProvidersQuery } from '@/utils/__generated__/graphql';
import { useProviderLink } from '@nhost/nextjs';
import NavLink from 'next/link';

export default function SocialProvidersSettings() {
  const { data, loading, error } = useGetAuthUserProvidersQuery();
  const isGithubConnected = data?.authUserProviders?.some(
    (item) => item.providerId === 'github',
  );

  const { github } = useProviderLink({
    connect: true,
    redirectTo: `${window.location.origin}/account`,
  });

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
            href={github}
            passHref
            target="_blank"
            rel="noreferrer noopener"
            legacyBehavior
          >
            <Button
              className=""
              variant="outlined"
              color="secondary"
              startIcon={<GitHubIcon />}
            >
              Connect with GitHub
            </Button>
          </NavLink>
        </Box>
      )}
    </SettingsContainer>
  );
}

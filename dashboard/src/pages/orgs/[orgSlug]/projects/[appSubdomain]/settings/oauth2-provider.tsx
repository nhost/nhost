import { useRouter } from 'next/router';
import type { ReactElement } from 'react';
import { Container } from '@/components/layout/Container';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Text } from '@/components/ui/v2/Text';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { SettingsLayout } from '@/features/orgs/layout/SettingsLayout';
import { MIN_AUTH_VERSION_OAUTH2 } from '@/features/orgs/projects/authentication/oauth2/constants';
import { OAuth2ProviderSettings } from '@/features/orgs/projects/authentication/settings/components/OAuth2ProviderSettings';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useSoftwareVersionsInfo } from '@/features/orgs/projects/common/hooks/useSoftwareVersionsInfo';
import { isVersionGte } from '@/utils/compareVersions';

export default function SettingsOAuth2ProviderPage() {
  const isPlatform = useIsPlatform();
  const { auth, loading: loadingVersions } = useSoftwareVersionsInfo();
  const router = useRouter();

  if (isPlatform && loadingVersions) {
    return (
      <Container
        className="flex h-full max-w-5xl flex-col"
        rootClassName="h-full"
      >
        <div className="flex flex-auto items-center justify-center overflow-hidden">
          <ActivityIndicator label="Loading..." />
        </div>
      </Container>
    );
  }

  if (
    isPlatform &&
    !isVersionGte(auth.configuredVersion, MIN_AUTH_VERSION_OAUTH2)
  ) {
    return (
      <Container className="mx-auto max-w-5xl space-y-5">
        <Box className="flex flex-col items-center justify-center space-y-5 rounded-lg border px-48 py-12 shadow-sm">
          <div className="flex flex-col space-y-1">
            <Text className="text-center font-medium" variant="h3">
              Auth Version Too Old
            </Text>
            <Text variant="subtitle1" className="text-center">
              OAuth2 Provider settings require Auth version{' '}
              {MIN_AUTH_VERSION_OAUTH2} or later. Please upgrade your Auth
              service in the Settings page.
            </Text>
          </div>
          <Button
            variant="contained"
            color="primary"
            onClick={() =>
              router.push(
                `/orgs/${router.query.orgSlug}/projects/${router.query.appSubdomain}/settings/authentication`,
              )
            }
          >
            Go to Auth Settings
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container
      className="grid max-w-5xl grid-flow-row gap-y-6 bg-transparent"
      rootClassName="bg-transparent"
    >
      <OAuth2ProviderSettings />
    </Container>
  );
}

SettingsOAuth2ProviderPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <OrgLayout>
      <SettingsLayout>
        <Container
          sx={{ backgroundColor: 'background.default' }}
          className="max-w-5xl"
        >
          {page}
        </Container>
      </SettingsLayout>
    </OrgLayout>
  );
};

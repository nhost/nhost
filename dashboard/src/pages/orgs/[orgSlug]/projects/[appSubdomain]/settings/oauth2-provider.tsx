import { useRouter } from 'next/router';
import type { ReactElement } from 'react';
import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardHeader,
} from '@/components/layout/SettingsCard';
import { Button } from '@/components/ui/v3/button';
import { Spinner } from '@/components/ui/v3/spinner';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { SettingsLayout } from '@/features/orgs/layout/SettingsLayout';
import { MIN_AUTH_VERSION_OAUTH2 } from '@/features/orgs/projects/authentication/oauth2/constants';
import { OAuth2ProviderSettings } from '@/features/orgs/projects/authentication/settings/components/OAuth2ProviderSettings';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useSoftwareVersionsInfo } from '@/features/orgs/projects/common/hooks/useSoftwareVersionsInfo';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useGetOAuth2ProviderSettingsQuery } from '@/generated/graphql';
import { isVersionGte } from '@/utils/compareVersions';

export default function SettingsOAuth2ProviderPage() {
  const isPlatform = useIsPlatform();
  const { project, loading: loadingProject } = useProject();
  const localMimirClient = useLocalMimirClient();
  const { auth, loading: loadingVersions } = useSoftwareVersionsInfo();
  const router = useRouter();

  const { data, error } = useGetOAuth2ProviderSettingsQuery({
    variables: { appId: project?.id },
    fetchPolicy: 'cache-and-network',
    skip: !project?.id,
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  if (error) {
    throw error;
  }

  const isInitialLoading =
    loadingProject || !project?.id || !data || (isPlatform && loadingVersions);

  if (isInitialLoading) {
    return (
      <Spinner size="medium" wrapperClassName="gap-2">
        Loading...
      </Spinner>
    );
  }

  if (
    isPlatform &&
    !isVersionGte(auth.configuredVersion, MIN_AUTH_VERSION_OAUTH2)
  ) {
    return (
      <SettingsCard>
        <SettingsCardHeader
          title="Auth Version Too Old"
          description={`OAuth2 Provider settings require Auth version ${MIN_AUTH_VERSION_OAUTH2} or later. Please upgrade your Auth service in the Settings page.`}
        />
        <SettingsCardContent>
          <Button
            className="justify-self-start"
            onClick={() =>
              router.push(
                `/orgs/${router.query.orgSlug}/projects/${router.query.appSubdomain}/settings/authentication`,
              )
            }
          >
            Go to Auth Settings
          </Button>
        </SettingsCardContent>
      </SettingsCard>
    );
  }

  return (
    <div className="grid grid-flow-row gap-y-6">
      <OAuth2ProviderSettings />
    </div>
  );
}

SettingsOAuth2ProviderPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <OrgLayout>
      <SettingsLayout>
        <div className="mx-auto w-full max-w-5xl px-5 py-4">{page}</div>
      </SettingsLayout>
    </OrgLayout>
  );
};

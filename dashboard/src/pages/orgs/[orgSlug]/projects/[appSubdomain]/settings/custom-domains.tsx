import type { ReactElement } from 'react';
import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
import { Container } from '@/components/layout/Container';
import { Box } from '@/components/ui/v2/Box';
import { Text } from '@/components/ui/v2/Text';
import { Spinner } from '@/components/ui/v3/spinner';
import { TextLink } from '@/components/ui/v3/text-link';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { SettingsLayout } from '@/features/orgs/layout/SettingsLayout';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useRunServices } from '@/features/orgs/projects/common/hooks/useRunServices';
import { AuthDomain } from '@/features/orgs/projects/custom-domains/settings/components/AuthDomain';
import { DatabaseDomain } from '@/features/orgs/projects/custom-domains/settings/components/DatabaseDomain';
import { HasuraDomain } from '@/features/orgs/projects/custom-domains/settings/components/HasuraDomain';
import { RunServiceDomains } from '@/features/orgs/projects/custom-domains/settings/components/RunServiceDomains';
import { ServerlessFunctionsDomain } from '@/features/orgs/projects/custom-domains/settings/components/ServerlessFunctionsDomain';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import {
  useGetAuthenticationSettingsQuery,
  useGetHasuraSettingsQuery,
  useGetServerlessFunctionsSettingsQuery,
} from '@/generated/graphql';

export default function CustomDomains() {
  const { org } = useCurrentOrg();
  const { project, loading: loadingProject } = useProject();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { services, loading: loadingRunServices } = useRunServices();
  const isFreePlan = !!org?.plan?.isFree;

  const clientProps = !isPlatform ? { client: localMimirClient } : {};

  const { data: authData, error: authError } =
    useGetAuthenticationSettingsQuery({
      variables: { appId: project?.id },
      skip: isFreePlan || !project?.id,
      ...clientProps,
    });

  const { data: hasuraData, error: hasuraError } = useGetHasuraSettingsQuery({
    variables: { appId: project?.id },
    skip: isFreePlan || !project?.id,
    ...clientProps,
  });

  const { data: functionsData, error: functionsError } =
    useGetServerlessFunctionsSettingsQuery({
      variables: { appId: project?.id },
      skip: isFreePlan || !project?.id,
      ...clientProps,
    });

  if (org?.plan?.isFree) {
    return (
      <Container
        className="grid grid-flow-row gap-6 bg-transparent"
        rootClassName="bg-transparent"
      >
        <UpgradeToProBanner
          section="custom-domains"
          title="To unlock Custom Domains, transfer this project to a Pro or Team organization."
          description=""
        />
      </Container>
    );
  }

  if (authError || hasuraError || functionsError) {
    throw authError || hasuraError || functionsError;
  }

  const isInitialLoading =
    loadingProject ||
    !project?.id ||
    !authData ||
    !hasuraData ||
    !functionsData ||
    (loadingRunServices && services.length === 0);

  if (isInitialLoading) {
    return (
      <Spinner size="medium" wrapperClassName="gap-2">
        Loading custom domain settings...
      </Spinner>
    );
  }

  return (
    <Container
      className="grid max-w-5xl grid-flow-row gap-6 bg-transparent"
      rootClassName="bg-transparent"
    >
      <Box className="flex flex-row items-center gap-4 overflow-hidden rounded-lg border-1 p-4">
        <div className="flex flex-col space-y-2">
          <Text className="font-semibold text-lg">Custom Domains</Text>

          <Text color="secondary">
            Add a custom domain to Auth, Hasura, PostgreSQL, and your Run
            services for only a $10 flat fee 🚀 <br /> Learn more about
            <TextLink
              href="https://docs.nhost.io/platform/cloud/custom-domains"
              external
              className="ml-1 font-medium"
            >
              Custom Domains
            </TextLink>
          </Text>
        </div>
      </Box>

      <AuthDomain />
      <HasuraDomain />
      <DatabaseDomain />

      <ServerlessFunctionsDomain />
      <RunServiceDomains services={services} />
    </Container>
  );
}

CustomDomains.getLayout = function getLayout(page: ReactElement) {
  return (
    <OrgLayout
      mainContainerProps={{
        className: 'flex h-full overflow-auto',
      }}
    >
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

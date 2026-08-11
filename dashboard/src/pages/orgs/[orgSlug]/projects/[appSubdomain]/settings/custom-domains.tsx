import type { ReactElement } from 'react';
import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
import {
  SettingsCard,
  SettingsCardFooter,
  SettingsCardHeader,
  SettingsDocsLink,
} from '@/components/layout/SettingsCard';
import { Spinner } from '@/components/ui/v3/spinner';
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
      <div className="grid grid-flow-row gap-6">
        <UpgradeToProBanner
          title="To unlock Custom Domains, transfer this project to a Pro or Team organization."
          description=""
        />
      </div>
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
    <div className="grid grid-flow-row gap-6">
      <SettingsCard>
        <SettingsCardHeader
          title="Custom Domains"
          description="Add a custom domain to Auth, Hasura, PostgreSQL, and your Run services for only a $10 flat fee 🚀"
        />
        <SettingsCardFooter>
          <SettingsDocsLink
            href="https://docs.nhost.io/platform/cloud/custom-domains"
            title="Custom Domains"
          />
        </SettingsCardFooter>
      </SettingsCard>

      <AuthDomain />
      <HasuraDomain />
      <DatabaseDomain />

      <ServerlessFunctionsDomain />
      <RunServiceDomains services={services} />
    </div>
  );
}

CustomDomains.getLayout = function getLayout(page: ReactElement) {
  return (
    <OrgLayout>
      <SettingsLayout>
        <div className="mx-auto w-full max-w-5xl px-5 py-4">{page}</div>
      </SettingsLayout>
    </OrgLayout>
  );
};

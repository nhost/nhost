import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
import { Container } from '@/components/layout/Container';
import { SettingsLayout } from '@/components/layout/SettingsLayout';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useGetEnvironmentVariablesQuery } from '@/utils/__generated__/graphql';
import type { ReactElement } from 'react';

export default function CustomDomains() {
  const { currentProject } = useCurrentWorkspaceAndProject();
  const { loading, error } = useGetEnvironmentVariablesQuery({
    variables: { appId: currentProject?.id },
  });

  if (loading) {
    return <ActivityIndicator delay={1000} label="Loading custom domains..." />;
  }

  if (currentProject.plan.isFree) {
    return (
      <Container
        className="grid grid-flow-row gap-6 bg-transparent"
        rootClassName="bg-transparent"
      >
        <UpgradeToProBanner
          title="Upgrade to Nhost Pro to unlock custom domains"
          description="In publishing and graphic design, Lorem ipsum is a placeholder text
          commonly used to demonstrate the visual form of a document or a
          typeface without relying on meaningful content."
        />
      </Container>
    );
  }

  if (error) {
    throw error;
  }

  return (
    <Container
      className="grid max-w-5xl grid-flow-row gap-6 bg-transparent"
      rootClassName="bg-transparent"
    >
      <span>Fill this with the domains settings</span>
    </Container>
  );
}

// This hould a project exporeted from the main settings page
// And for now this is really important
// CustomDomains

CustomDomains.getLayout = function getLayout(page: ReactElement) {
  return <SettingsLayout>{page}</SettingsLayout>;
};

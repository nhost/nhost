import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
import { Container } from '@/components/layout/Container';
import { SettingsLayout } from '@/components/layout/SettingsLayout';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Box } from '@/components/ui/v2/Box';
import { Text } from '@/components/ui/v2/Text';
import { AISettings } from '@/features/ai/settings/components';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import type { ReactElement } from 'react';

export default function StorageSettingsPage() {
  const { currentProject, loading, error } = useCurrentWorkspaceAndProject();

  if (currentProject?.legacyPlan?.isFree) {
    return (
      <Box className="p-4" sx={{ backgroundColor: 'background.default' }}>
        <UpgradeToProBanner
          title="Upgrade to Nhost Pro."
          description={
            <Text>
              Graphite is an addon to the Pro plan. To unlock it, please upgrade
              to Pro first.
            </Text>
          }
        />
      </Box>
    );
  }

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading AI settings..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  return (
    <Container
      className="grid max-w-5xl grid-flow-row gap-y-6 bg-transparent"
      rootClassName="bg-transparent"
    >
      <AISettings />
    </Container>
  );
}

StorageSettingsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <ProjectLayout
      mainContainerProps={{
        className: 'flex h-full',
      }}
    >
      <SettingsLayout>
        <Container sx={{ backgroundColor: 'background.default' }}>
          {page}
        </Container>
      </SettingsLayout>
    </ProjectLayout>
  );
};

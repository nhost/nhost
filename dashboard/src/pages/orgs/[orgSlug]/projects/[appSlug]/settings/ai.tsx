import { Container } from '@/components/layout/Container';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Box } from '@/components/ui/v2/Box';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { SettingsLayout } from '@/features/orgs/layout/SettingsLayout';
import { AISettings } from '@/features/orgs/projects/ai/settings/components';
import { UpgradeNotification } from '@/features/orgs/projects/common/components/UpgradeNotification';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import type { ReactElement } from 'react';

export default function AISettingsPage() {
  const { org, loading, error } = useCurrentOrg();

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading AI settings..."
        className="justify-center"
      />
    );
  }

  if (org?.plan?.isFree) {
    return (
      <Box className="p-4" sx={{ backgroundColor: 'background.default' }}>
        <UpgradeNotification
          title="Upgrade to Pro."
          message="Graphite is an addon to the Pro plan. To unlock it, please upgrade to Pro first."
        />
      </Box>
    );
  }

  if (error) {
    throw error;
  }

  return (
    <Container
      className="grid max-w-5xl grid-flow-row bg-transparent gap-y-6"
      rootClassName="bg-transparent"
    >
      <AISettings />
    </Container>
  );
}

AISettingsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <ProjectLayout
      mainContainerProps={{
        className: 'flex h-full',
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
    </ProjectLayout>
  );
};

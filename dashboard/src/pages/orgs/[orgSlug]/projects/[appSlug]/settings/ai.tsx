import { AISettings } from '@/features/orgs/projects/ai/settings/components';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Box } from '@/components/ui/v2/Box';
import { Container } from '@/components/layout/Container';
import type { ReactElement } from 'react';
import { SettingsLayout } from '@/components/layout/SettingsLayout';
import { UpgradeNotification } from '@/features/orgs/projects/common/components/UpgradeNotification';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';

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
  return <SettingsLayout>{page}</SettingsLayout>;
};

import { Container } from '@/components/layout/Container';
import { SettingsLayout } from '@/components/layout/SettingsLayout';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import DeleteSMTPSettings from '@/features/authentication/settings/components/DeleteSMTPSettings/DeleteSMTPSettings';
import { PostmarkSettings } from '@/features/authentication/settings/components/PostmarkSettings';
import { SMTPSettings } from '@/features/authentication/settings/components/SMTPSettings';
import { UpgradeNotification } from '@/features/projects/common/components/UpgradeNotification';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/hooks/useLocalMimirClient';
import { useGetSmtpSettingsQuery } from '@/utils/__generated__/graphql';
import type { ReactElement } from 'react';

export default function SMTPSettingsPage() {
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { currentProject } = useCurrentWorkspaceAndProject();

  const { loading, error } = useGetSmtpSettingsQuery({
    variables: { appId: currentProject?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  if (isPlatform && currentProject?.plan?.isFree) {
    return (
      <Container
        className="grid max-w-5xl grid-flow-row gap-4 bg-transparent"
        rootClassName="bg-transparent"
      >
        <UpgradeNotification message="Unlock SMTP settings by upgrading your project to the Pro plan." />
      </Container>
    );
  }

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading SMTP settings..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  return (
    <Container
      className="grid max-w-5xl grid-flow-row gap-4 bg-transparent"
      rootClassName="bg-transparent"
    >
      <SMTPSettings />
      <PostmarkSettings />
      <DeleteSMTPSettings />
    </Container>
  );
}

SMTPSettingsPage.getLayout = function getLayout(page: ReactElement) {
  return <SettingsLayout>{page}</SettingsLayout>;
};

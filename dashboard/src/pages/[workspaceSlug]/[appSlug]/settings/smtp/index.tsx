import { Container } from '@/components/layout/Container';
import { SettingsLayout } from '@/components/layout/SettingsLayout';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Option } from '@/components/ui/v2/Option';
import { Select } from '@/components/ui/v2/Select';
import DeleteSMTPSettings from '@/features/authentication/settings/components/DeleteSMTPSettings/DeleteSMTPSettings';
import { PostmarkSettings } from '@/features/authentication/settings/components/PostmarkSettings';
import { SMTPSettings } from '@/features/authentication/settings/components/SMTPSettings';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { UpgradeNotification } from '@/features/projects/common/components/UpgradeNotification';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/hooks/useLocalMimirClient';
import { useGetSmtpSettingsQuery } from '@/utils/__generated__/graphql';
import { useEffect, useState, type ReactElement } from 'react';

export default function SMTPSettingsPage() {
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { currentProject } = useCurrentWorkspaceAndProject();

  const [mode, setMode] = useState('postmark');

  const { data, loading, error } = useGetSmtpSettingsQuery({
    variables: { appId: currentProject?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { host } = data?.config?.provider?.smtp || {};

  useEffect(() => {
    setMode(host !== 'postmark' ? 'smtp' : 'postmark');
  }, [host]);

  if (isPlatform && currentProject?.legacyPlan?.isFree) {
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
      <Select
        slotProps={{
          popper: { disablePortal: false, className: 'z-[10000]' },
        }}
        value={mode}
        onChange={(_, value) => setMode(value as string)}
        fullWidth
      >
        <Option key="smtp" value="smtp">
          SMTP
        </Option>
        <Option key="postmark" value="postmark">
          Postmark
        </Option>
      </Select>

      {mode === 'postmark' ? <PostmarkSettings /> : <SMTPSettings />}
      <DeleteSMTPSettings />
    </Container>
  );
}

SMTPSettingsPage.getLayout = function getLayout(page: ReactElement) {
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

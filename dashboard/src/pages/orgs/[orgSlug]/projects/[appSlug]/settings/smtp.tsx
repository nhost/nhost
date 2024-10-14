import { Container } from '@/components/layout/Container';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Option } from '@/components/ui/v2/Option';
import { Select } from '@/components/ui/v2/Select';
import { useGetSmtpSettingsQuery } from '@/utils/__generated__/graphql';
import { useEffect, useState, type ReactElement } from 'react';

import DeleteSMTPSettings from '@/features/orgs/projects/authentication/settings/components/DeleteSMTPSettings/DeleteSMTPSettings';
import { PostmarkSettings } from '@/features/orgs/projects/authentication/settings/components/PostmarkSettings';
import { SMTPSettings } from '@/features/orgs/projects/authentication/settings/components/SMTPSettings';
import { UpgradeNotification } from '@/features/orgs/projects/common/components/UpgradeNotification';

import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { SettingsLayout } from '@/features/orgs/layout/SettingsLayout';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export default function SMTPSettingsPage() {
  const { org } = useCurrentOrg();
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();

  const [mode, setMode] = useState('postmark');

  const { data, loading, error } = useGetSmtpSettingsQuery({
    variables: { appId: project?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { host } = data?.config?.provider?.smtp || {};

  useEffect(() => {
    setMode(host !== 'postmark' ? 'smtp' : 'postmark');
  }, [host]);

  if (isPlatform && org?.plan?.isFree) {
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

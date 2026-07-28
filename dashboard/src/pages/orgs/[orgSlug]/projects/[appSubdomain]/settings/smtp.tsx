import { type ReactElement, useEffect, useState } from 'react';
import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
import { Container } from '@/components/layout/Container';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { Spinner } from '@/components/ui/v3/spinner';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { SettingsLayout } from '@/features/orgs/layout/SettingsLayout';
import DeleteSMTPSettings from '@/features/orgs/projects/authentication/settings/components/DeleteSMTPSettings/DeleteSMTPSettings';
import { PostmarkSettings } from '@/features/orgs/projects/authentication/settings/components/PostmarkSettings';
import { SMTPSettings } from '@/features/orgs/projects/authentication/settings/components/SMTPSettings';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useGetSmtpSettingsQuery } from '@/generated/graphql';

export default function SMTPSettingsPage() {
  const { org } = useCurrentOrg();
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();

  const [mode, setMode] = useState('postmark');

  const { data, loading, error } = useGetSmtpSettingsQuery({
    variables: { appId: project?.id },
    fetchPolicy: 'cache-and-network',
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { host } = data?.config?.provider?.smtp || {};

  useEffect(() => {
    setMode(host !== 'postmark' ? 'smtp' : 'postmark');
  }, [host]);

  if (loading) {
    return (
      <Spinner size="medium" wrapperClassName="gap-2">
        Loading SMTP settings...
      </Spinner>
    );
  }

  if (isPlatform && org?.plan?.isFree) {
    return (
      <Container
        className="grid grid-flow-row gap-6 bg-transparent"
        rootClassName="bg-transparent"
      >
        <UpgradeToProBanner
          title="To unlock custom SMTP, transfer this project to a Pro or Team organization."
          description=""
        />
      </Container>
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
      <Select value={mode} onValueChange={setMode}>
        <SelectTrigger aria-label="SMTP provider">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="z-[10000]">
          <SelectItem value="smtp">SMTP</SelectItem>
          <SelectItem value="postmark">Postmark</SelectItem>
        </SelectContent>
      </Select>

      {mode === 'postmark' ? <PostmarkSettings /> : <SMTPSettings />}
      <DeleteSMTPSettings />
    </Container>
  );
}

SMTPSettingsPage.getLayout = function getLayout(page: ReactElement) {
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

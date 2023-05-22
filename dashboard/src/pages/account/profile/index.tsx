import { Container } from '@/components/layout/Container';
import { AccountSettingsLayout } from '@/features/account/settings/components/AccountSettingsLayout';
import { PasswordSettings } from '@/features/account/settings/components/PasswordSettings';
import type { ReactElement } from 'react';

export default function ProfileSettingsPage() {
  return (
    <Container
      className="grid max-w-5xl grid-flow-row gap-8 bg-transparent"
      rootClassName="bg-transparent"
    >
      <PasswordSettings />
    </Container>
  );
}

ProfileSettingsPage.getLayout = function getLayout(page: ReactElement) {
  return <AccountSettingsLayout>{page}</AccountSettingsLayout>;
};

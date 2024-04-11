import { Container } from '@/components/layout/Container';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { AccountSettingsLayout } from '@/features/account/settings/components/AccountSettingsLayout';
import { DeleteAccount } from '@/features/account/settings/components/DeleteAccount';
import { DisplayNameSetting } from '@/features/account/settings/components/DisplayNameSetting';
import { EmailSetting } from '@/features/account/settings/components/EmailSetting';
import { PasswordSettings } from '@/features/account/settings/components/PasswordSettings';
import { PATSettings } from '@/features/account/settings/components/PATSettings';
import { SocialProvidersSettings } from '@/features/account/settings/components/SocialProvidersSettings';
import type { ReactElement } from 'react';

export default function AccountSettingsPage() {
  return (
    <Container
      className="grid max-w-5xl grid-flow-row gap-8 bg-transparent"
      rootClassName="bg-transparent"
    >
      <RetryableErrorBoundary>
        <DisplayNameSetting />
      </RetryableErrorBoundary>

      <RetryableErrorBoundary>
        <EmailSetting />
      </RetryableErrorBoundary>

      <RetryableErrorBoundary>
        <PasswordSettings />
      </RetryableErrorBoundary>

      <RetryableErrorBoundary>
        <SocialProvidersSettings />
      </RetryableErrorBoundary>

      <RetryableErrorBoundary>
        <PATSettings />
      </RetryableErrorBoundary>

      <DeleteAccount />
    </Container>
  );
}

AccountSettingsPage.getLayout = function getLayout(page: ReactElement) {
  return <AccountSettingsLayout>{page}</AccountSettingsLayout>;
};

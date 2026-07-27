import type { ReactElement } from 'react';
import { Container } from '@/components/layout/Container';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Spinner } from '@/components/ui/v3/spinner';
import { AccountMfaSettings } from '@/features/account/settings/components/AccountMfaSettings';
import { AccountSettingsLayout } from '@/features/account/settings/components/AccountSettingsLayout';
import { DeleteAccount } from '@/features/account/settings/components/DeleteAccount';
import { DisplayNameSetting } from '@/features/account/settings/components/DisplayNameSetting';
import { EmailSetting } from '@/features/account/settings/components/EmailSetting';
import { PATSettings } from '@/features/account/settings/components/PATSettings';
import { PasswordSettings } from '@/features/account/settings/components/PasswordSettings';
import { SecurityKeysSettings } from '@/features/account/settings/components/SecurityKeysSettings';
import { SocialProvidersSettings } from '@/features/account/settings/components/SocialProvidersSettings';
import {
  useGetAuthUserProvidersQuery,
  useGetPersonalAccessTokensQuery,
} from '@/generated/graphql';

export default function AccountSettingsPage() {
  const {
    data: personalAccessTokensData,
    loading: loadingPersonalAccessTokens,
  } = useGetPersonalAccessTokensQuery();
  const { data: authUserProvidersData, loading: loadingAuthUserProviders } =
    useGetAuthUserProvidersQuery();

  const isInitialLoading =
    (!personalAccessTokensData && loadingPersonalAccessTokens) ||
    (!authUserProvidersData && loadingAuthUserProviders);

  if (isInitialLoading) {
    return (
      <Spinner size="medium" wrapperClassName="gap-2">
        Loading account settings...
      </Spinner>
    );
  }

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
        <AccountMfaSettings />
      </RetryableErrorBoundary>
      <RetryableErrorBoundary>
        <SecurityKeysSettings />
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

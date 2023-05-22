import { Container } from '@/components/layout/Container';
import { AccountSettingsLayout } from '@/features/account/settings/components/AccountSettingsLayout';
import { PATSettings } from '@/features/account/settings/components/PATSettings';
import { ActivityIndicator } from '@/ui/v2/ActivityIndicator';
import { useGetPersonalAccessTokensQuery } from '@/utils/__generated__/graphql';
import type { ReactElement } from 'react';

export default function PersonalAccessTokenSettingsPage() {
  const { loading, error } = useGetPersonalAccessTokensQuery();

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading personal access tokens..."
      />
    );
  }

  if (error) {
    throw error;
  }

  return (
    <Container
      className="grid max-w-5xl grid-flow-row gap-8 bg-transparent"
      rootClassName="bg-transparent"
    >
      <PATSettings />
    </Container>
  );
}

PersonalAccessTokenSettingsPage.getLayout = function getLayout(
  page: ReactElement,
) {
  return <AccountSettingsLayout>{page}</AccountSettingsLayout>;
};

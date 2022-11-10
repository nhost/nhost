import providers from '@/data/providers.json';
import { resolveProvider } from '@/utils/resolveProvider';
import type { GetAppFragment } from '@/utils/__generated__/graphql';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { ProviderHeader } from './ProviderHeader';
import { ProviderInfo } from './ProviderInfo';
import { ProviderSettings } from './ProviderSettings';

type ProviderPageProps = {
  app: GetAppFragment;
};

export function ProviderPage({ app }: ProviderPageProps) {
  const router = useRouter();

  const providerId = router.query.providerId as string;

  const providerEnabled = app[`auth${resolveProvider(providerId)}Enabled`];

  const [authProviderEnabled, setAuthProviderEnabled] =
    useState(providerEnabled);

  const provider = providers.find(
    (availableProvider) => providerId === availableProvider.name.toLowerCase(),
  );

  return (
    <>
      <ProviderHeader provider={provider} />
      <ProviderInfo
        provider={provider}
        authProviderEnabled={authProviderEnabled}
        setAuthProviderEnabled={setAuthProviderEnabled}
      />
      <ProviderSettings
        provider={provider}
        app={app}
        authProviderEnabled={authProviderEnabled}
      />
    </>
  );
}

export default ProviderPage;

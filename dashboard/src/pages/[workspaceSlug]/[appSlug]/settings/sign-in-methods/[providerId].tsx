import { ProviderPagePreload } from '@/components/applications/providers/ProviderIdPagePreload';
import Container from '@/components/layout/Container';
import SettingsLayout from '@/components/settings/SettingsLayout';
import providers from '@/data/providers.json';
import { useRouter } from 'next/router';
import type { ReactElement } from 'react';
import { useLayoutEffect } from 'react';

export default function ProviderIdPage() {
  const router = useRouter();
  const providerId = router.query.providerId as string;

  useLayoutEffect(() => {
    // If someone enters the URL directly, check if the provider is active.
    const provider = providers.find(
      (availableProvider) =>
        providerId === availableProvider.name.toLowerCase(),
    );

    if (!provider) {
      router.push('/');
      return;
    }

    if (
      provider.active === false &&
      process.env.NEXT_PUBLIC_ENV === 'production'
    ) {
      router.push('/');
    }
  }, [providerId, router]);

  return (
    <Container>
      <ProviderPagePreload />
    </Container>
  );
}

ProviderIdPage.getLayout = function getLayout(page: ReactElement) {
  return <SettingsLayout>{page}</SettingsLayout>;
};

import { useRouter } from 'next/router';
import { type ComponentType, useEffect } from 'react';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import type { AuthenticationSection } from '@/features/account/settings/accountSettingsTabs';
import { AccountMfaSettings } from '@/features/account/settings/components/AccountMfaSettings';
import { PasswordSettings } from '@/features/account/settings/components/PasswordSettings';
import { SecurityKeysSettings } from '@/features/account/settings/components/SecurityKeysSettings';
import { SocialProvidersSettings } from '@/features/account/settings/components/SocialProvidersSettings';

const SECTIONS: {
  id: AuthenticationSection;
  title: string;
  Card: ComponentType;
}[] = [
  { id: 'password', title: 'Password', Card: PasswordSettings },
  {
    id: 'two-factor-authentication',
    title: 'Two-factor authentication',
    Card: AccountMfaSettings,
  },
  { id: 'security-keys', title: 'Security keys', Card: SecurityKeysSettings },
  {
    id: 'connected-accounts',
    title: 'Connected accounts',
    Card: SocialProvidersSettings,
  },
];

/**
 * Every way to sign in on one page: password, two-factor, security keys and
 * connected accounts. Each card keeps its own logic and gets a heading with
 * an anchor, so the profile header can link straight to it.
 */
export default function AuthenticationSettings() {
  const { asPath } = useRouter();
  const hash = asPath.split('#')[1];

  // The page scrolls inside its own container and the cards render after
  // the tab switch, so scroll to the linked card once it is on screen.
  useEffect(() => {
    if (hash) {
      document.getElementById(hash)?.scrollIntoView({ block: 'start' });
    }
  }, [hash]);

  return (
    <div className="grid grid-flow-row gap-8">
      {SECTIONS.map(({ id, title, Card }) => (
        <section
          key={id}
          id={id}
          aria-labelledby={`${id}-title`}
          className="grid scroll-mt-6 grid-flow-row gap-3"
        >
          <h2 id={`${id}-title`} className="font-semibold text-lg">
            {title}
          </h2>
          <RetryableErrorBoundary>
            <Card />
          </RetryableErrorBoundary>
        </section>
      ))}
    </div>
  );
}

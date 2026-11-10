import { useRouter } from 'next/router';
import { type ComponentType, useEffect } from 'react';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import type { AuthenticationSection } from '@/features/account/settings/accountSettingsTabs';
import { AccountMfaSettings } from '@/features/account/settings/components/AccountMfaSettings';
import { PasswordSettings } from '@/features/account/settings/components/PasswordSettings';
import { SecurityKeysSettings } from '@/features/account/settings/components/SecurityKeysSettings';
import { SocialProvidersSettings } from '@/features/account/settings/components/SocialProvidersSettings';
import highlightSection from '@/features/account/settings/utils/highlightSection';
import { cn } from '@/lib/utils';

interface Section {
  id: AuthenticationSection;
  title: string;
  Card: ComponentType;
}

// Each row is a list of sections side by side. The two on/off tiles share a
// row, the others take the full width.
const ROWS: Section[][] = [
  [{ id: 'password', title: 'Password', Card: PasswordSettings }],
  [
    {
      id: 'two-factor-authentication',
      title: 'Two-factor authentication',
      Card: AccountMfaSettings,
    },
    {
      id: 'connected-accounts',
      title: 'Connected accounts',
      Card: SocialProvidersSettings,
    },
  ],
  [{ id: 'passkeys', title: 'Passkeys', Card: SecurityKeysSettings }],
];

function AuthenticationSectionBlock({ id, title, Card }: Section) {
  return (
    // The card is the last child. `highlightSection` sets data-highlighted
    // for a moment, giving it a ring and a soft blue tint that fade out.
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="grid scroll-mt-[calc(var(--account-header-height)+1.5rem)] grid-rows-[auto_1fr] gap-3 [&>:last-child]:transition-[box-shadow,background-color] [&>:last-child]:duration-700 motion-reduce:[&>:last-child]:transition-none [&[data-highlighted=true]>:last-child]:bg-primary/5 [&[data-highlighted=true]>:last-child]:shadow-[0_0_0_2px_hsl(var(--primary)/0.6)]"
    >
      <h2 id={`${id}-title`} className="font-semibold text-lg">
        {title}
      </h2>
      <RetryableErrorBoundary>
        <Card />
      </RetryableErrorBoundary>
    </section>
  );
}

/**
 * Every way to sign in on one page: password, then two-factor and connected
 * accounts side by side, then passkeys. Each card keeps its own logic and gets a heading with
 * an anchor, so the profile header can link straight to it.
 */
export default function AuthenticationSettings() {
  const { asPath } = useRouter();
  const hash = asPath.split('#')[1];

  // The page scrolls inside its own container and the cards render after
  // the tab switch, so go to the linked card once it is on screen.
  useEffect(() => {
    if (hash) {
      highlightSection(hash);
    }
  }, [hash]);

  return (
    <div className="grid grid-flow-row gap-8">
      {ROWS.map((row) => (
        <div
          key={row[0].id}
          className={cn(
            'grid gap-8 sm:gap-6',
            row.length > 1 && 'sm:grid-cols-2',
          )}
        >
          {row.map((section) => (
            <AuthenticationSectionBlock key={section.id} {...section} />
          ))}
        </div>
      ))}
    </div>
  );
}

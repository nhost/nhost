import { ArrowRight, BadgeCheck } from 'lucide-react';
import NextLink from 'next/link';
import type { ReactNode } from 'react';
import UserAvatar from '@/components/layout/AccountMenu/UserAvatar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import {
  type AuthenticationSection,
  getAccountSettingsHref,
} from '@/features/account/settings/accountSettingsTabs';
import useMfaEnabled from '@/features/account/settings/components/AccountMfaSettings/hooks/useMfaEnabled';
import { StatusDot } from '@/features/account/settings/components/StatusDot';
import useGetSecurityKeys from '@/features/account/settings/hooks/useGetSecurityKeys';
import highlightSection from '@/features/account/settings/utils/highlightSection';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useGetAuthUserProvidersQuery } from '@/generated/graphql';
import { useUserData } from '@/hooks/useUserData';

interface ProfileStatusProps {
  active: boolean;
  section: AuthenticationSection;
  children: ReactNode;
}

// A status dot and its label, linking to the card where that setting lives.
// No border or padding, so it lines up with the name and email above it. At
// rest it reads as a flag; on hover the label underlines and an arrow slides
// in, so it's clear it's a link.
function ProfileStatus({ active, section, children }: ProfileStatusProps) {
  return (
    <NextLink
      href={getAccountSettingsHref('authentication', section)}
      // Already on that link, the URL doesn't change and nothing would
      // happen, so light the card up again by hand.
      onClick={() => highlightSection(section)}
      className="group/status inline-flex items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground"
    >
      <StatusDot active={active} />
      <span className="underline-offset-4 group-hover/status:underline">
        {children}
      </span>
      <ArrowRight
        aria-hidden
        className="-ml-1 h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all duration-200 group-hover/status:translate-x-0 group-hover/status:opacity-100 motion-reduce:transition-none"
      />
    </NextLink>
  );
}

function ProfileStat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-end px-5 first:pl-0 last:pr-0">
      <span className="font-semibold text-2xl">{value}</span>
      <span className="text-muted-foreground text-xs">{label}</span>
    </div>
  );
}

function pluralize(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/**
 * Profile summary at the top of the account settings: avatar, name, email,
 * how many organizations and projects the user belongs to, member since and
 * the security status. Display only, everything is edited on the pages below.
 */
export default function AccountProfileHeader() {
  const user = useUserData();
  const { isMfaEnabled, loading: loadingMfa } = useMfaEnabled();
  const { data: securityKeysData } = useGetSecurityKeys();
  const { data: providersData } = useGetAuthUserProvidersQuery();
  const { orgs, loading: loadingOrgs } = useOrgs();

  const securityKeyCount = securityKeysData?.authUserSecurityKeys.length ?? 0;
  const isGithubConnected = !!providersData?.authUserProviders?.some(
    ({ providerId }) => providerId === 'github',
  );
  const projectCount = orgs.reduce((total, org) => total + org.apps.length, 0);
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    // Hidden on phones: it repeats what the pages show and pushes the
    // settings below the fold. Same breakpoint as the sidebar dropdown.
    // Frosted glass: the pages show through as they scroll under it. Once
    // the page scrolls (`data-scrolled` on the sticky wrapper) it lifts with
    // a shadow and its bottom edge catches the light, with a soft glow.
    <div className="relative hidden border-b bg-muted/50 shadow-none backdrop-blur-md backdrop-saturate-150 transition-shadow duration-200 before:pointer-events-none before:absolute before:inset-x-0 before:-bottom-1 before:h-2 before:bg-gradient-to-r before:from-transparent before:via-foreground/10 before:to-transparent before:opacity-0 before:blur-sm before:transition-opacity before:duration-200 after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-gradient-to-r after:from-transparent after:via-foreground/30 after:to-transparent after:opacity-0 after:transition-opacity after:duration-200 group-data-[scrolled=true]/account-header:shadow-lg group-data-[scrolled=true]/account-header:after:opacity-100 group-data-[scrolled=true]/account-header:before:opacity-100 motion-reduce:transition-none md:block">
      <div className="mx-auto flex w-full max-w-6xl flex-row items-center gap-6 px-5 py-6">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <UserAvatar className="h-20 w-20 shrink-0 text-2xl" />

          <div className="grid min-w-0">
            <h2 className="truncate font-semibold text-2xl leading-tight">
              {user?.displayName || user?.email}
            </h2>

            <p className="flex min-w-0 items-center gap-1.5 text-muted-foreground leading-tight">
              <span className="truncate">{user?.email}</span>
              {user?.emailVerified && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <BadgeCheck
                      aria-label="Verified"
                      className="h-4 w-4 shrink-0 text-primary"
                    />
                  </TooltipTrigger>
                  <TooltipContent>Verified</TooltipContent>
                </Tooltip>
              )}
            </p>

            {/* Each status waits for its own data, so it never flashes the
                wrong state. */}
            {providersData && (
              <div className="mt-2 flex">
                <ProfileStatus
                  active={isGithubConnected}
                  section="connected-accounts"
                >
                  {isGithubConnected ? 'GitHub linked' : 'GitHub not linked'}
                </ProfileStatus>
              </div>
            )}
          </div>
        </div>

        <div className="grid shrink-0 justify-items-end gap-5">
          <div className="flex divide-x">
            {!loadingOrgs && (
              <>
                <ProfileStat value={orgs.length} label="Organizations" />
                <ProfileStat value={projectCount} label="Projects" />
              </>
            )}
            {memberSince && (
              <ProfileStat value={memberSince} label="Member since" />
            )}
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2 sm:justify-end">
            {!loadingMfa && (
              <ProfileStatus
                active={isMfaEnabled}
                section="two-factor-authentication"
              >
                {isMfaEnabled ? 'Two-factor on' : 'Two-factor off'}
              </ProfileStatus>
            )}
            {securityKeysData && (
              <ProfileStatus active={securityKeyCount > 0} section="passkeys">
                {securityKeyCount > 0
                  ? pluralize(securityKeyCount, 'passkey')
                  : 'No passkeys'}
              </ProfileStatus>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

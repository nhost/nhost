import { BadgeCheck } from 'lucide-react';
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
import useGetSecurityKeys from '@/features/account/settings/hooks/useGetSecurityKeys';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useGetAuthUserProvidersQuery } from '@/generated/graphql';
import { useUserData } from '@/hooks/useUserData';
import { cn } from '@/lib/utils';

interface ProfileStatusProps {
  active: boolean;
  section: AuthenticationSection;
  children: ReactNode;
}

// A status dot and its label, linking to the card where that setting lives.
// No border or padding, so it lines up with the name and email above it.
function ProfileStatus({ active, section, children }: ProfileStatusProps) {
  return (
    <NextLink
      href={getAccountSettingsHref('authentication', section)}
      className="inline-flex items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground"
    >
      <span
        aria-hidden="true"
        className={cn(
          'h-2 w-2 shrink-0 rounded-full',
          active ? 'bg-success' : 'bg-muted-foreground/40',
        )}
      />
      {children}
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
    <div className="shrink-0 border-b bg-muted/50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-6 sm:flex-row sm:items-center">
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

            {/* Each pill waits for its own data, so it never flashes the
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

        <div className="flex shrink-0 flex-col gap-5 sm:items-end">
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
              <ProfileStatus
                active={securityKeyCount > 0}
                section="security-keys"
              >
                {securityKeyCount > 0
                  ? pluralize(securityKeyCount, 'security key')
                  : 'No security keys'}
              </ProfileStatus>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

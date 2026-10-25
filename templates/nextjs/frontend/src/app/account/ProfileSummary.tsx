import type { User } from '@nhost/nhost-js/auth';
import AvatarForm from '@/app/account/AvatarForm';
import CopyUserId from '@/app/account/CopyUserId';
import DisplayNameField from '@/app/account/DisplayNameField';
import UserAvatar from '@/components/UserAvatar';
import { Card } from '@/components/ui/card';

// A fixed locale and zone rather than the visitor's: this renders on the
// server, which knows neither, and the day it says has to be the one the auth
// service stored.
const joined = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeZone: 'UTC',
});

export default function ProfileSummary({ user }: { user: User }) {
  return (
    <Card className="flex-row flex-wrap items-center gap-x-5 gap-y-3 p-5 sm:flex-nowrap">
      {/* Nothing to take down when the account has no avatar at all. */}
      <AvatarForm canRemove={Boolean(user.avatarUrl)}>
        <UserAvatar
          avatarUrl={user.avatarUrl}
          displayName={user.displayName}
          width={192}
          className="size-18 text-2xl"
        />
      </AvatarForm>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <DisplayNameField displayName={user.displayName} />
        <p className="text-muted-foreground text-sm">
          Joined {joined.format(new Date(user.createdAt))}
        </p>
      </div>

      {/* What a developer reads and the account's owner mostly does not, so
          it is small and off to the side. On a narrow screen it drops under
          the name, lined up with it rather than with the avatar. The role is
          the default one on its own: `user.roles` always carries `me` as
          well, which says nothing here. */}
      <div className="flex basis-full flex-wrap items-center gap-x-3 gap-y-1.5 pl-23 sm:basis-auto sm:flex-col sm:flex-nowrap sm:items-end sm:pl-0">
        <CopyUserId id={user.id} />
        <p className="whitespace-nowrap text-muted-foreground/70 text-xs">
          Role{' '}
          <span className="font-medium text-muted-foreground">
            {user.defaultRole}
          </span>{' '}
          · Locale{' '}
          <span className="font-medium text-muted-foreground">
            {user.locale}
          </span>
        </p>
      </div>
    </Card>
  );
}

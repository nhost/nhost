import type { User } from '@nhost/nhost-js/auth';
import AvatarForm from '@/app/account/AvatarForm';
import CopyUserId from '@/app/account/CopyUserId';
import DisplayNameField from '@/app/account/DisplayNameField';
import UserAvatar from '@/components/UserAvatar';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// A fixed locale and zone rather than the visitor's: this renders on the
// server, which knows neither, and the day it says has to be the one the auth
// service stored.
const joined = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeZone: 'UTC',
});

// The role is the default one on its own: `user.roles` always carries `me`
// as well, which says nothing here.
function RoleAndLocale({ user, className }: { user: User; className: string }) {
  return (
    <p className={cn('text-muted-foreground/70 text-xs', className)}>
      Role{' '}
      <span className="font-medium text-muted-foreground">
        {user.defaultRole}
      </span>{' '}
      · Locale{' '}
      <span className="font-medium text-muted-foreground">{user.locale}</span>
    </p>
  );
}

function Joined({ user, className }: { user: User; className: string }) {
  return (
    <p className={cn('text-muted-foreground text-sm', className)}>
      Joined {joined.format(new Date(user.createdAt))}
    </p>
  );
}

export default function ProfileSummary({ user }: { user: User }) {
  return (
    <Card className="flex-row items-center gap-5 p-5">
      {/* Nothing to take down when the account has no avatar at all. */}
      <AvatarForm canRemove={Boolean(user.avatarUrl)}>
        <UserAvatar
          avatarUrl={user.avatarUrl}
          displayName={user.displayName}
          width={192}
          className="size-18 text-2xl"
        />
      </AvatarForm>

      {/* The id, role and locale are what a developer reads and the
          account's owner mostly does not, so they are small. The id goes
          under the name rather than beside it: beside it, a long name and a
          whole id took the room from each other. The joined date, with the
          role and locale close under it, sits at the right of both, except on
          a phone, where the name needs that room and they go under the id. */}
      <div className="grid min-w-0 flex-1 gap-y-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-3">
        <div className="min-w-0">
          <DisplayNameField displayName={user.displayName} />
        </div>
        <div className="flex min-w-0">
          <CopyUserId id={user.id} />
        </div>
        <div className="flex min-w-0 flex-col items-start gap-0.5 sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:items-end sm:justify-center">
          <Joined user={user} className="whitespace-nowrap" />
          <RoleAndLocale
            user={user}
            className="max-w-full truncate sm:whitespace-nowrap"
          />
        </div>
      </div>
    </Card>
  );
}

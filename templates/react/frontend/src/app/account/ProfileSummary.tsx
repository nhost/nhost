import type { User } from '@nhost/nhost-js/auth';
import UserAvatar from '@/components/UserAvatar';
import { Card } from '@/components/ui/card';

export default function ProfileSummary({ user }: { user: User }) {
  return (
    <Card className="flex-row items-center gap-5 p-5">
      <UserAvatar displayName={user.displayName} className="size-18 text-2xl" />
      <p className="min-w-0 flex-1 truncate font-medium">
        {user.email ?? user.id}
      </p>
    </Card>
  );
}

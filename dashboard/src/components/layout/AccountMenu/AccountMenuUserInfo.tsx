import { LOCAL_DISPLAY_NAME } from '@/components/layout/AccountMenu/constants';
import UserAvatar from '@/components/layout/AccountMenu/UserAvatar';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useUserData } from '@/hooks/useUserData';
import { cn } from '@/lib/utils';

export default function AccountMenuUserInfo() {
  const isPlatform = useIsPlatform();
  const user = useUserData();
  const displayName = isPlatform ? user?.displayName : LOCAL_DISPLAY_NAME;
  const email = isPlatform ? user?.email : undefined;

  return (
    <div
      className={cn(
        'grid grid-flow-col items-center justify-start gap-3 p-0 sm:p-4',
        !isPlatform && 'gap-4',
      )}
    >
      <UserAvatar className="h-10 w-10" />

      <div className="grid grid-flow-row gap-0.5">
        <span className="font-semibold">{displayName}</span>
        {email && (
          <span className="text-muted-foreground text-sm">{email}</span>
        )}
      </div>
    </div>
  );
}

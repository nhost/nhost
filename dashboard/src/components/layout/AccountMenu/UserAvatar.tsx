import DashboardAvatar from '@/components/common/DashboardAvatar';
import { LOCAL_DISPLAY_NAME } from '@/components/layout/AccountMenu/constants';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useUserData } from '@/hooks/useUserData';

interface UserAvatarProps {
  className?: string;
}

export default function UserAvatar({ className }: UserAvatarProps) {
  const isPlatform = useIsPlatform();
  const user = useUserData();
  const name = isPlatform ? user?.displayName || undefined : LOCAL_DISPLAY_NAME;
  const src = isPlatform ? user?.avatarUrl : undefined;

  return (
    <DashboardAvatar
      alt={name}
      src={src}
      name={name}
      email={isPlatform ? user?.email : undefined}
      className={className}
    />
  );
}

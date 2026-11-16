import { LOCAL_DISPLAY_NAME } from '@/components/layout/AccountMenu/constants';
import { Avatar } from '@/components/ui/v3/avatar';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useUserData } from '@/hooks/useUserData';

interface UserAvatarProps {
  className?: string;
}

export default function UserAvatar({ className }: UserAvatarProps) {
  const isPlatform = useIsPlatform();
  const user = useUserData();
  const name = isPlatform
    ? user?.displayName || user?.email || undefined
    : LOCAL_DISPLAY_NAME;
  const src = isPlatform ? user?.avatarUrl : undefined;

  return <Avatar alt={name} src={src} name={name} className={className} />;
}

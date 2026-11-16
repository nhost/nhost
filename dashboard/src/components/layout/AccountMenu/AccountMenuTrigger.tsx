import { UserIcon } from 'lucide-react';
import type { Ref } from 'react';
import UserAvatar from '@/components/layout/AccountMenu/UserAvatar';
import { Button } from '@/components/ui/v3/button';
import { PopoverTrigger } from '@/components/ui/v3/popover';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';

export interface AccountMenuTriggerProps {
  triggerRef?: Ref<HTMLButtonElement>;
}

export default function AccountMenuTrigger({
  triggerRef,
}: AccountMenuTriggerProps) {
  const isPlatform = useIsPlatform();
  return (
    <PopoverTrigger asChild>
      <Button
        ref={triggerRef}
        variant="subtle"
        size="icon-sm"
        aria-label="Open account menu"
        className="rounded-full"
      >
        {isPlatform ? (
          <UserAvatar className="h-full w-full" />
        ) : (
          <UserIcon className="h-4 w-4" />
        )}
      </Button>
    </PopoverTrigger>
  );
}

import { Settings } from 'lucide-react';
import NextLink from 'next/link';
import { MenuRow } from '@/components/ui/v3/menu-row';

interface AccountMenuActionsProps {
  onNavigate?: VoidFunction;
}

export default function AccountMenuActions({
  onNavigate,
}: AccountMenuActionsProps) {
  return (
    <div className="grid grid-flow-row gap-1 p-2">
      <MenuRow asChild>
        <NextLink href="/account" onClick={onNavigate}>
          <Settings className="h-4 w-4" />
          Account settings
        </NextLink>
      </MenuRow>
    </div>
  );
}

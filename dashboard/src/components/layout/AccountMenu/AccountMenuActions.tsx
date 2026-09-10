import { Settings } from 'lucide-react';
import { NavLink } from '@/components/common/NavLink';

interface AccountMenuActionsProps {
  onNavigate?: VoidFunction;
}

export default function AccountMenuActions({
  onNavigate,
}: AccountMenuActionsProps) {
  return (
    <div className="grid grid-flow-row gap-1 p-2">
      <NavLink
        variant="ghost"
        underline="none"
        className="h-9 w-full justify-start gap-2 px-2"
        href="/account"
        onClick={onNavigate}
      >
        <Settings className="h-4 w-4" />
        Account Settings
      </NavLink>
    </div>
  );
}

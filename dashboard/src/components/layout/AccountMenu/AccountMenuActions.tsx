import { Settings } from 'lucide-react';
import { NavLink } from '@/components/common/NavLink';
import {
  dashboardNavItemIconClassName,
  dashboardNavItemTextClassName,
} from '@/components/layout/DashboardSidebar/DashboardSidebar';
import { cn } from '@/lib/utils';

interface AccountMenuActionsProps {
  onNavigate?: VoidFunction;
}

const navItemClassName = cn(
  'h-9 w-full justify-start gap-2.5 px-2',
  dashboardNavItemTextClassName,
);

export default function AccountMenuActions({
  onNavigate,
}: AccountMenuActionsProps) {
  return (
    <div className="grid grid-flow-row gap-1 p-2">
      <NavLink
        variant="ghost"
        underline="none"
        className={navItemClassName}
        href="/account"
        onClick={onNavigate}
      >
        <Settings className={cn('h-4 w-4', dashboardNavItemIconClassName)} />
        Account Settings
      </NavLink>
    </div>
  );
}

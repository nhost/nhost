import { BookOpen, LifeBuoy, Settings } from 'lucide-react';
import { NavLink } from '@/components/common/NavLink';
import {
  dashboardNavItemIconClassName,
  dashboardNavItemTextClassName,
} from '@/components/layout/DashboardSidebar/DashboardSidebar';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
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
  const isPlatform = useIsPlatform();

  return (
    <div className="grid grid-flow-row gap-1 p-2">
      {isPlatform && (
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
      )}

      {isPlatform && (
        <NavLink
          variant="ghost"
          underline="none"
          className={navItemClassName}
          href="/support"
          target="_blank"
          rel="noopener noreferrer"
          onClick={onNavigate}
        >
          <LifeBuoy className={cn('h-4 w-4', dashboardNavItemIconClassName)} />
          Support
        </NavLink>
      )}

      <NavLink
        variant="ghost"
        underline="none"
        className={navItemClassName}
        href="https://docs.nhost.io"
        target="_blank"
        rel="noopener noreferrer"
        onClick={onNavigate}
      >
        <BookOpen className={cn('h-4 w-4', dashboardNavItemIconClassName)} />
        Docs
      </NavLink>
    </div>
  );
}

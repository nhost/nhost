import { BookOpen, LifeBuoy, Settings } from 'lucide-react';
import { NavLink } from '@/components/common/NavLink';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';

interface AccountMenuActionsProps {
  onNavigate?: VoidFunction;
}

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
          className="h-9 w-full justify-start gap-2 px-2"
          href="/account"
          onClick={onNavigate}
        >
          <Settings className="h-4 w-4" />
          Account Settings
        </NavLink>
      )}

      {isPlatform && (
        <NavLink
          variant="ghost"
          underline="none"
          className="h-9 w-full justify-start gap-2 px-2"
          href="/support"
          target="_blank"
          rel="noopener noreferrer"
          onClick={onNavigate}
        >
          <LifeBuoy className="h-4 w-4" />
          Support
        </NavLink>
      )}

      <NavLink
        variant="ghost"
        underline="none"
        className="h-9 w-full justify-start gap-2 px-2"
        href="https://docs.nhost.io"
        target="_blank"
        rel="noopener noreferrer"
        onClick={onNavigate}
      >
        <BookOpen className="h-4 w-4" />
        Docs
      </NavLink>
    </div>
  );
}

import { ThemeSwitcher } from '@/components/common/ThemeSwitcher';
import AccountMenuActions from '@/components/layout/AccountMenu/AccountMenuActions';
import AccountMenuSignOut from '@/components/layout/AccountMenu/AccountMenuSignOut';
import { Separator } from '@/components/ui/v3/separator';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { getDashboardVersion } from '@/utils/env';

interface AccountMenuContentProps {
  onNavigate?: VoidFunction;
}

export default function AccountMenuContent({
  onNavigate,
}: AccountMenuContentProps) {
  const isPlatform = useIsPlatform();

  return (
    <div className="grid grid-flow-row">
      <Separator />

      <AccountMenuActions onNavigate={onNavigate} />

      <Separator />

      <div className="p-2">
        <ThemeSwitcher />
      </div>

      {isPlatform && (
        <>
          <Separator />
          <AccountMenuSignOut />
        </>
      )}

      <Separator />

      <div className="py-4 text-center text-muted-foreground text-xs">
        Dashboard Version: {getDashboardVersion()}
      </div>
    </div>
  );
}

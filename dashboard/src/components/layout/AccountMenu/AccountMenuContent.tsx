import { ThemeSwitcher } from '@/components/common/ThemeSwitcher';
import AccountMenuActions from '@/components/layout/AccountMenu/AccountMenuActions';
import { Separator } from '@/components/ui/v3/separator';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { cn } from '@/lib/utils';
import { getDashboardVersion } from '@/utils/env';

interface AccountMenuContentProps {
  onAccountSettingsClick?: VoidFunction;
}

export default function AccountMenuContent({
  onAccountSettingsClick,
}: AccountMenuContentProps) {
  const isPlatform = useIsPlatform();

  return (
    <div className="grid grid-flow-row">
      <Separator className="hidden sm:block" />

      <div
        className={cn('p-0 sm:p-2', !isPlatform && 'grid grid-flow-row gap-2')}
      >
        <ThemeSwitcher />
      </div>

      {isPlatform && (
        <AccountMenuActions onAccountSettingsClick={onAccountSettingsClick} />
      )}

      <Separator />

      <div className="py-4 text-center text-muted-foreground text-xs">
        Dashboard Version: {getDashboardVersion()}
      </div>
    </div>
  );
}

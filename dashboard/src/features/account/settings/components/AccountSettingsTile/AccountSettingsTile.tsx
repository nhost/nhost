import type { ReactNode } from 'react';
import { AccountSettingsCard } from '@/features/account/settings/components/AccountSettingsCard';
import { StatusDot } from '@/features/account/settings/components/StatusDot';
import { cn } from '@/lib/utils';

interface AccountSettingsTileProps {
  /** Shown in a box at the top of the tile. */
  icon: ReactNode;
  title: ReactNode;
  /** Whether the setting is on, shown as a dot next to the title. */
  active: boolean;
  /** The status text, e.g. "On" or "Linked". */
  status: string;
  description: ReactNode;
  /** The one button that changes the setting, at the bottom of the tile. */
  action: ReactNode;
}

/**
 * A small card for a setting that is either on or off, like two-factor or a
 * linked account. Tiles sit side by side and stretch to the same height, with
 * the button pinned to the bottom.
 */
export default function AccountSettingsTile({
  icon,
  title,
  active,
  status,
  description,
  action,
}: AccountSettingsTileProps) {
  return (
    <AccountSettingsCard className="flex h-full flex-col px-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
        {icon}
      </div>

      <div className="grid gap-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="font-semibold text-lg">{title}</h3>
          <span
            className={cn(
              'inline-flex items-center gap-2 text-sm',
              active ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            <StatusDot active={active} />
            {status}
          </span>
        </div>
        <p className="text-muted-foreground">{description}</p>
      </div>

      <div className="mt-auto pt-2">{action}</div>
    </AccountSettingsCard>
  );
}

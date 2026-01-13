import { ScheduledEventStatus } from '@/utils/hasura-api/generated/schemas';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, Check, Clock3, Lock, Skull } from 'lucide-react';

type StatusIconConfig = {
  Icon: LucideIcon;
  colorClassName: string;
  label: string;
};

const STATUS_ICON_MAP: Record<ScheduledEventStatus, StatusIconConfig> = {
  [ScheduledEventStatus.scheduled]: {
    Icon: Clock3,
    colorClassName: 'text-slate-500 dark:text-slate-400',
    label: 'Scheduled',
  },
  [ScheduledEventStatus.locked]: {
    Icon: Lock,
    colorClassName: 'text-amber-600 dark:text-amber-400',
    label: 'Locked',
  },
  [ScheduledEventStatus.delivered]: {
    Icon: Check,
    colorClassName: 'text-green-600 dark:text-green-400',
    label: 'Delivered',
  },
  [ScheduledEventStatus.error]: {
    Icon: AlertTriangle,
    colorClassName: 'text-red-600 dark:text-red-400',
    label: 'Error',
  },
  [ScheduledEventStatus.dead]: {
    Icon: Skull,
    colorClassName: 'text-rose-600 dark:text-rose-400',
    label: 'Dead',
  },
};

export default function ScheduledEventStatusCell({
  status,
}: {
  status: ScheduledEventStatus;
}) {
  const { Icon, colorClassName, label } = STATUS_ICON_MAP[status];

  return (
    <div
      className="flex items-center justify-center"
      aria-label={label}
      title={label}
    >
      <Icon className={`h-4 w-4 ${colorClassName}`} />
    </div>
  );
}

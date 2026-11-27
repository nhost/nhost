import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SidebarNoticeRowProps {
  icon: ReactNode;
  children: ReactNode;
  tone?: 'muted' | 'primary' | 'warning';
  selected?: boolean;
  onClick: VoidFunction;
}

export default function SidebarNoticeRow({
  icon,
  children,
  tone = 'muted',
  selected,
  onClick,
}: SidebarNoticeRowProps) {
  return (
    <button
      type="button"
      aria-current={selected ? 'page' : undefined}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md p-2.5 text-left text-sm+ hover:bg-accent',
        tone === 'muted' && 'text-muted-foreground',
        tone === 'primary' && 'font-medium text-primary',
        tone === 'warning' && 'text-warning',
        selected && 'bg-table-selected',
      )}
    >
      <span className="shrink-0 [&_svg]:size-4">{icon}</span>
      <span className="truncate">{children}</span>
    </button>
  );
}

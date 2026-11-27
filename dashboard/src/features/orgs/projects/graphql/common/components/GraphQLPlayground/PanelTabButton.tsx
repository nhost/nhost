import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PanelTabButtonProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}

/** An underlined tab, like the GraphQL section tabs above the playground. */
export default function PanelTabButton({
  active,
  onClick,
  children,
}: PanelTabButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'flex h-full items-center gap-2 border-b-2 font-semibold text-sm transition-colors hover:text-primary',
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground',
      )}
    >
      {children}
    </button>
  );
}

import { X } from 'lucide-react';
import type { CommandNode } from '@/features/command-palette/types';
import { cn } from '@/lib/utils';

export interface ScopeChipProps {
  scope: CommandNode;
  onRemove: VoidFunction;
  className?: string;
}

export const ScopeChip = ({ scope, onRemove, className }: ScopeChipProps) => (
  <button
    aria-label={`Leave ${scope.title} scope`}
    className={cn(
      'inline-flex max-w-48 items-center gap-1 rounded-full bg-muted px-2 py-1 font-medium text-muted-foreground text-xs hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring',
      className,
    )}
    onClick={onRemove}
    type="button"
  >
    <span className="truncate">{scope.title}</span>
    <X aria-hidden="true" className="h-3 w-3 shrink-0" />
  </button>
);

import type { KeyboardEvent } from 'react';
import { useDataGridCell } from '@/features/orgs/projects/storage/dataGrid/components/DataGridCell';
import { cn } from '@/lib/utils';

export interface CellResetButtonsProps {
  isNullable?: boolean;
  hasDefault: boolean;
  onSetNull: () => void | Promise<void>;
  onSetDefault: () => void | Promise<void>;
  className?: string;
}

export default function CellResetButtons({
  isNullable,
  hasDefault,
  onSetNull,
  onSetDefault,
  className,
}: CellResetButtonsProps) {
  const { focusNextCell } = useDataGridCell();

  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    isLast: boolean,
  ) {
    if (event.key !== 'Tab') {
      return;
    }
    event.stopPropagation();
    if (!event.shiftKey && isLast) {
      event.preventDefault();
      focusNextCell();
    }
  }

  return (
    <div
      className={cn(
        'flex gap-px rounded border border-input bg-background shadow-sm',
        className,
      )}
    >
      {isNullable && (
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onSetNull()}
          onKeyDown={(event) => handleKeyDown(event, !hasDefault)}
          className="px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          NULL
        </button>
      )}
      {hasDefault && (
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onSetDefault()}
          onKeyDown={(event) => handleKeyDown(event, true)}
          className="px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          DEFAULT
        </button>
      )}
    </div>
  );
}

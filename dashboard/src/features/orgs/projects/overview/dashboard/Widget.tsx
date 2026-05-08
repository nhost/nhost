import { GripVertical, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/v3/button';
import { cn } from '@/lib/utils';

type WidgetProps = {
  editing: boolean;
  onRemove?: VoidFunction;
  children: ReactNode;
  className?: string;
};

export default function Widget({
  editing,
  onRemove,
  children,
  className,
}: WidgetProps) {
  return (
    <div
      className={cn(
        'group widget-drag-handle relative flex h-full w-full flex-col overflow-auto',
        editing &&
          'cursor-move rounded-lg outline-dashed outline-2 outline-primary-main/30 outline-offset-2 hover:outline-primary-main/60',
        className,
      )}
    >
      {editing ? (
        // biome-ignore lint/a11y/noStaticElementInteractions: stops drag, no keyboard interaction
        <div
          className="pointer-events-none absolute top-2 right-2 z-10 flex items-center gap-1"
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {onRemove ? (
            <Button
              variant="outline"
              size="icon"
              className="pointer-events-auto h-7 w-7 bg-paper shadow-sm hover:bg-destructive/10 hover:text-destructive"
              onClick={onRemove}
              aria-label="Remove widget"
              title="Remove"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          <span
            className="pointer-events-auto grid h-7 w-7 cursor-grab place-items-center rounded-md border bg-paper text-muted-foreground shadow-sm active:cursor-grabbing"
            aria-hidden="true"
            title="Drag to move"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </span>
        </div>
      ) : null}
      {children}
    </div>
  );
}

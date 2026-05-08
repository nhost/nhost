import { Check, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/v3/button';
import { cn } from '@/lib/utils';

type EditModeBarProps = {
  widgetCount: number;
  dirty: boolean;
  onDiscard: VoidFunction;
  onSave: VoidFunction;
};

export default function EditModeBar({
  widgetCount,
  dirty,
  onDiscard,
  onSave,
}: EditModeBarProps) {
  return (
    <div className="sticky bottom-0 z-10 mt-4 flex items-center gap-3 rounded-lg border bg-paper px-4 py-2.5 shadow-md">
      <div className="flex items-center gap-2.5 text-muted-foreground text-xs">
        <GripVertical className="h-3.5 w-3.5" />
        <span>Drag to move · resize from the bottom-right corner</span>
        <span className="hidden text-muted-foreground/50 md:inline">·</span>
        <span className="hidden md:inline">
          <b className="font-semibold text-foreground">{widgetCount}</b> widgets
        </span>
      </div>
      <div className="flex-1" />
      <span
        className={cn(
          'text-xs',
          dirty ? 'text-amber-500' : 'text-muted-foreground',
        )}
      >
        {dirty ? 'Unsaved changes' : 'No changes'}
      </span>
      <Button variant="ghost" size="sm" onClick={onDiscard}>
        Discard
      </Button>
      <Button size="sm" onClick={onSave} disabled={!dirty}>
        <Check className="mr-1.5 h-3.5 w-3.5" />
        Save layout
      </Button>
    </div>
  );
}

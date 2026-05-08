import { LayoutGrid, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/v3/button';

type FirstTimeRibbonProps = {
  onCustomize: VoidFunction;
  onDismiss: VoidFunction;
};

export default function FirstTimeRibbon({
  onCustomize,
  onDismiss,
}: FirstTimeRibbonProps) {
  return (
    <div className="mb-3 flex items-start gap-3 rounded-lg border bg-primary-highlight px-4 py-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary-main/15 text-primary-main">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-foreground text-sm">
          Make this dashboard yours.
        </div>
        <div className="text-muted-foreground text-xs leading-relaxed">
          Pin metrics, logs, and shortcuts that matter to your project. Click
          Customize to drag, resize, and add widgets.
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button size="sm" onClick={onCustomize}>
          <LayoutGrid className="mr-1.5 h-3.5 w-3.5" />
          Customize
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
          onClick={onDismiss}
          aria-label="Dismiss"
          title="Dismiss"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

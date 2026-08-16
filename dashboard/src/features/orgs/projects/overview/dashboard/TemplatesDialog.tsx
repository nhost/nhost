import { Check } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v3/dialog';
import TemplatePreview from '@/features/orgs/projects/overview/dashboard/TemplatePreview';
import {
  findMatchingTemplateId,
  TEMPLATES,
} from '@/features/orgs/projects/overview/dashboard/templates';
import type { DashboardLayout } from '@/features/orgs/projects/overview/dashboard/types';
import { cn } from '@/lib/utils';

type TemplatesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentLayout: DashboardLayout;
  onApply: (layout: DashboardLayout) => void;
};

export default function TemplatesDialog({
  open,
  onOpenChange,
  currentLayout,
  onApply,
}: TemplatesDialogProps) {
  const matching = findMatchingTemplateId(currentLayout);
  const [selected, setSelected] = useState(matching);

  const sel = TEMPLATES.find((t) => t.id === selected) ?? TEMPLATES[0];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setSelected(findMatchingTemplateId(currentLayout));
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-[760px] gap-0 p-0 text-foreground">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>Choose a template</DialogTitle>
          <DialogDescription>
            Start from a pre-made layout. You can still drag, resize, and add
            widgets after.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3.5 p-5">
          {TEMPLATES.map((tpl) => {
            const isSelected = tpl.id === selected;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => setSelected(tpl.id)}
                className={cn(
                  'flex flex-col gap-3 rounded-xl border bg-paper p-3 text-left transition-all',
                  isSelected
                    ? 'border-primary-main shadow-[0_0_0_3px_hsl(var(--primary-main)/0.18)]'
                    : 'hover:border-secondary-300',
                )}
              >
                <div className="relative aspect-[16/11] overflow-hidden rounded-lg border bg-background-default p-2">
                  <TemplatePreview layout={tpl.layout} />
                  {isSelected ? (
                    <div className="absolute top-2 right-2 grid h-[22px] w-[22px] place-items-center rounded-full bg-primary-main text-white shadow-sm">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                  ) : null}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <div className="font-semibold text-foreground text-sm">
                      {tpl.name}
                    </div>
                    {tpl.id === 'default' ? (
                      <span className="rounded bg-secondary-200 px-1.5 py-0.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
                        Default
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-muted-foreground text-xs leading-snug">
                    {tpl.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <DialogFooter className="flex-row items-center justify-between border-t px-5 py-3">
          <span className="text-muted-foreground text-xs">
            Replaces your current arrangement.
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={() => onApply(sel.layout)}>
              <Check className="mr-1.5 h-3.5 w-3.5" />
              Apply {sel.name}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

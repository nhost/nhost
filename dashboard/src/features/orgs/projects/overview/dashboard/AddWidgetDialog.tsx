import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v3/dialog';
import { Input } from '@/components/ui/v3/input';
import { WIDGET_TYPES } from '@/features/orgs/projects/overview/dashboard/registry';
import type {
  WidgetCategory,
  WidgetType,
} from '@/features/orgs/projects/overview/dashboard/types';
import { cn } from '@/lib/utils';

type AddWidgetDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingTypes: WidgetType[];
  onAdd: (type: WidgetType) => void;
};

const CATEGORIES: ('All' | WidgetCategory)[] = [
  'All',
  'Metrics',
  'Activity',
  'Services',
  'Resources',
];

export default function AddWidgetDialog({
  open,
  onOpenChange,
  onAdd,
}: AddWidgetDialogProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'All' | WidgetCategory>('All');

  const counts = useMemo(() => {
    const c: Record<string, number> = { All: Object.keys(WIDGET_TYPES).length };
    for (const meta of Object.values(WIDGET_TYPES)) {
      c[meta.cat] = (c[meta.cat] ?? 0) + 1;
    }
    return c;
  }, []);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.entries(WIDGET_TYPES).filter(([, meta]) => {
      if (category !== 'All' && meta.cat !== category) {
        return false;
      }
      if (
        q &&
        !meta.name.toLowerCase().includes(q) &&
        !meta.desc.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    }) as [WidgetType, (typeof WIDGET_TYPES)[WidgetType]][];
  }, [query, category]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-0 p-0 text-foreground">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>Add a widget</DialogTitle>
          <DialogDescription>
            Pick a widget to drop into the next free slot on your dashboard.
          </DialogDescription>
        </DialogHeader>
        <div className="relative border-b px-5 py-3">
          <Search className="absolute top-1/2 left-7 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search widgets…"
            className="pl-9"
          />
        </div>
        <div
          className="grid h-[440px]"
          style={{ gridTemplateColumns: '160px 1fr' }}
        >
          <div className="flex flex-col border-r p-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={cn(
                  'flex items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm transition-colors',
                  category === c
                    ? 'bg-secondary-100 font-medium text-foreground'
                    : 'text-muted-foreground hover:bg-secondary-100/60',
                )}
              >
                <span>{c}</span>
                <span className="text-muted-foreground/70 text-xs">
                  {counts[c] ?? 0}
                </span>
              </button>
            ))}
          </div>
          <div className="overflow-y-auto p-3">
            <div className="grid grid-cols-2 gap-2">
              {items.map(([type, meta]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => onAdd(type)}
                  className="flex flex-col gap-1 rounded-lg border bg-paper p-3 text-left transition-colors hover:border-primary-main hover:bg-primary-highlight"
                >
                  <div className="font-semibold text-foreground text-sm">
                    {meta.name}
                  </div>
                  <div className="text-muted-foreground text-xs leading-snug">
                    {meta.desc}
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-muted-foreground/70 uppercase tracking-wide">
                    {meta.default.w}×{meta.default.h} · {meta.cat}
                  </div>
                </button>
              ))}
              {items.length === 0 ? (
                <div className="col-span-2 px-4 py-8 text-center text-muted-foreground text-sm">
                  No widgets match &ldquo;{query}&rdquo;.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

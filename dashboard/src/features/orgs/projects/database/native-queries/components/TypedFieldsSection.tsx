import { Plus } from 'lucide-react';
import { type ReactNode, useId } from 'react';
import { Button } from '@/components/ui/v3/button';
import { cn } from '@/lib/utils';

interface TypedFieldsSectionProps {
  label: string;
  addLabel: string;
  layout: 'contained' | 'flow';
  children: ReactNode;
  className?: string;
  error?: string;
  onAdd: VoidFunction;
}

export default function TypedFieldsSection({
  label,
  addLabel,
  layout,
  children,
  className,
  error,
  onAdd,
}: TypedFieldsSectionProps) {
  const labelId = useId();
  const isContained = layout === 'contained';

  return (
    <section
      aria-labelledby={labelId}
      data-layout={layout}
      className={cn(
        isContained ? 'flex min-h-0 flex-1 flex-col' : 'space-y-3',
        className,
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between',
          isContained && 'shrink-0 pt-5',
        )}
      >
        <h2 id={labelId} className="font-medium text-sm leading-none">
          {label}
        </h2>
        <Button type="button" variant="outline" onClick={onAdd}>
          <Plus className="mr-2 h-4 w-4" /> {addLabel}
        </Button>
      </div>
      <div
        className={cn(
          'space-y-3',
          isContained &&
            'relative mt-3 min-h-0 flex-1 overflow-y-auto pr-1 pb-4',
        )}
      >
        {children}
        {error && <p className="text-destructive text-sm">{error}</p>}
      </div>
    </section>
  );
}

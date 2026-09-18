import { Plus } from 'lucide-react';
import { type ReactNode, useId } from 'react';
import { Button } from '@/components/ui/v3/button';
import { Label } from '@/components/ui/v3/label';
import { cn } from '@/lib/utils';

export type TypedFieldsVariant = 'field' | 'argument';

export const TYPED_FIELDS_GRID_CLASS_NAMES: Record<TypedFieldsVariant, string> =
  {
    field:
      'w-full grid-cols-[minmax(8.5rem,1fr)_minmax(7rem,0.8fr)_minmax(10.5rem,1.25fr)_5rem_6rem_4rem] min-w-[43.5rem]',
    argument:
      'w-full grid-cols-[minmax(11rem,1fr)_minmax(14rem,1.25fr)_5rem_6rem_4rem] min-w-[42rem]',
  };

const SECTION_CONFIG: Record<
  TypedFieldsVariant,
  { label: string; addLabel: string; headers: readonly (string | null)[] }
> = {
  field: {
    label: 'Fields',
    addLabel: 'Add field',
    headers: ['Name', 'Kind', 'Type/value', 'Nullable', 'Description', null],
  },
  argument: {
    label: 'Arguments',
    addLabel: 'Add argument',
    headers: ['Name', 'Type', 'Nullable', 'Description', null],
  },
};

interface TypedFieldsSectionProps {
  variant: TypedFieldsVariant;
  children: ReactNode;
  className?: string;
  error?: string;
  onAdd: VoidFunction;
}

export default function TypedFieldsSection({
  variant,
  children,
  className,
  error,
  onAdd,
}: TypedFieldsSectionProps) {
  const labelId = useId();
  const { label, addLabel, headers } = SECTION_CONFIG[variant];

  return (
    <section
      aria-labelledby={labelId}
      data-variant={variant}
      className={cn('flex min-h-0 flex-1 flex-col', className)}
    >
      <h2
        id={labelId}
        className="shrink-0 pt-5 font-medium text-sm leading-none"
      >
        {label}
      </h2>

      <div className="relative mt-5 min-h-0 flex-1 overflow-y-auto pb-4">
        <div
          data-testid={`${variant}-editor-region`}
          className="w-full overflow-x-auto pb-2"
        >
          <div
            data-testid={`${variant}-scroll-content`}
            className="w-max min-w-full pr-1"
          >
            <div
              className={cn(
                'grid items-center gap-2 pb-2',
                TYPED_FIELDS_GRID_CLASS_NAMES[variant],
              )}
            >
              {headers.map((header) => {
                if (header === null) {
                  return <span key="action" aria-hidden="true" />;
                }

                const isCentered =
                  header === 'Nullable' || header === 'Description';

                return (
                  <Label
                    key={header}
                    asChild
                    className={cn(isCentered && 'text-center')}
                  >
                    <span>{header}</span>
                  </Label>
                );
              })}
            </div>
            <div>{children}</div>
          </div>
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <div className="py-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-2 text-primary hover:text-primary"
            onClick={onAdd}
          >
            <Plus className="h-4 w-4" />
            {addLabel}
          </Button>
        </div>
      </div>
    </section>
  );
}

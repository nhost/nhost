import type { LucideIcon } from 'lucide-react';
import type { DetailedHTMLProps, HTMLProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps
  extends Omit<
    DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement>,
    'title' | 'action'
  > {
  /**
   * Title of the empty state.
   */
  title: ReactNode;
  /**
   * Description of the empty state.
   */
  description?: ReactNode;
  /**
   * Icon component of the section. Rendered only when provided. Size, stroke
   * and color always come from EmptyState, never from the page.
   */
  icon?: LucideIcon;
  /**
   * Call to action rendered below the description.
   */
  action?: ReactNode;
}

export default function EmptyState({
  title,
  description,
  icon: Icon,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex h-full w-full flex-1 flex-col items-center justify-center gap-5 px-4 py-16 text-center',
        className,
      )}
      {...props}
    >
      {Icon && (
        <Icon
          aria-hidden="true"
          strokeWidth={1}
          className="h-12 w-12 shrink-0 text-disabled"
        />
      )}
      <div className="flex w-full flex-col gap-1 sm:max-w-md">
        <h3 className="font-semibold text-foreground text-lg">{title}</h3>
        {description && (
          <div className="text-muted-foreground text-sm">{description}</div>
        )}
      </div>
      {action}
    </div>
  );
}

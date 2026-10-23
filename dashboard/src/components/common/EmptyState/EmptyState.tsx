import { Database } from 'lucide-react';
import type {
  ComponentType,
  DetailedHTMLProps,
  HTMLProps,
  ReactNode,
} from 'react';
import { cn } from '@/lib/utils';

export type EmptyStateIconComponent = ComponentType<{
  className?: string;
  strokeWidth?: number;
}>;

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
   * Icon component of the section. Defaults to the Database icon, `null`
   * hides the icon. Size, stroke and color always come from EmptyState,
   * never from the page.
   */
  icon?: EmptyStateIconComponent | null;
  /**
   * Call to action rendered below the description.
   */
  action?: ReactNode;
}

interface EmptyStateIconProps {
  icon?: EmptyStateIconComponent | null;
}

function EmptyStateIcon({ icon }: EmptyStateIconProps) {
  if (icon === null) {
    return null;
  }

  const Icon = icon ?? Database;

  return (
    <span aria-hidden="true" className="flex shrink-0 text-disabled">
      <Icon strokeWidth={1} className="h-12 w-12" />
    </span>
  );
}

export default function EmptyState({
  title,
  description,
  icon,
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
      <EmptyStateIcon icon={icon} />
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

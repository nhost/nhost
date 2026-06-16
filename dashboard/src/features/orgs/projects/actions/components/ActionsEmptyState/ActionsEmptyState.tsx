import { Workflow } from 'lucide-react';
import type { DetailedHTMLProps, HTMLProps, ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

export interface ActionsEmptyStateProps
  extends Omit<
    DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement>,
    'title'
  > {
  /**
   * Title of the empty state.
   */
  title: ReactNode;
  /**
   * Description of the empty state.
   */
  description: ReactNode;
  /**
   * Optional content rendered below the description, e.g. a call-to-action.
   */
  children?: ReactNode;
}

export default function ActionsEmptyState({
  title,
  description,
  className,
  children,
  ...props
}: ActionsEmptyStateProps) {
  return (
    <div className="h-full w-full bg-background">
      <div
        className={twMerge(
          'grid w-full place-content-center gap-6 px-4 py-16 text-center',
          className,
        )}
        {...props}
      >
        <div className="mx-auto">
          <Workflow className="h-12 w-12" />
        </div>

        <h3 className="scroll-m-20 font-medium text-2xl tracking-tight">
          {title}
        </h3>

        <p className="mx-auto max-w-prose leading-7">{description}</p>

        {children && (
          <div className="flex flex-col items-center gap-4">{children}</div>
        )}
      </div>
    </div>
  );
}

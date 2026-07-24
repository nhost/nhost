import { Workflow } from 'lucide-react';
import type { DetailedHTMLProps, HTMLProps, ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

export interface ActionsEmptyStateProps
  extends Omit<
    DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement>,
    'title'
  > {
  title: ReactNode;
  description: ReactNode;
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
          'flex w-full flex-col items-center px-4 py-16 text-center',
          className,
        )}
        {...props}
      >
        <Workflow className="h-12 w-12" />

        <h3 className="mt-6 scroll-m-20 font-medium text-2xl tracking-tight">
          {title}
        </h3>

        <p className="mt-4 max-w-prose text-left leading-7">{description}</p>

        {children && (
          <div className="mt-10 flex flex-col items-center gap-4">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

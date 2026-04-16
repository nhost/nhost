import { Code } from 'lucide-react';
import type { DetailedHTMLProps, HTMLProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface FunctionsEmptyStateProps
  extends Omit<
    DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement>,
    'title'
  > {
  title: ReactNode;
  description: ReactNode;
}

export default function FunctionsEmptyState({
  title,
  description,
  className,
  ...props
}: FunctionsEmptyStateProps) {
  return (
    <div className="h-full w-full bg-background">
      <div
        className={cn(
          'grid w-full place-content-center gap-2 px-4 py-16 text-center',
          className,
        )}
        {...props}
      >
        <div className="mx-auto">
          <Code className="h-12 w-12" />
        </div>

        <h3 className="scroll-m-20 font-medium text-2xl tracking-tight">
          {title}
        </h3>

        <p className="leading-7 [&:not(:first-child)]:mt-6">{description}</p>
      </div>
    </div>
  );
}

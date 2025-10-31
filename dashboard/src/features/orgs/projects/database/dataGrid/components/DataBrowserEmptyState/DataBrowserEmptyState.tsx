import { cn } from '@/lib/utils';
import Image from 'next/image';
import type { DetailedHTMLProps, HTMLProps, ReactNode } from 'react';

export interface DataBrowserEmptyStateProps
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
}

export default function DataBrowserEmptyState({
  title,
  description,
  className,
  ...props
}: DataBrowserEmptyStateProps) {
  return (
    <div
      className={cn(
        'grid w-full place-content-center gap-2 px-4 py-16 text-center',
        className,
      )}
      {...props}
    >
      <div className="mx-auto">
        <Image
          src="/assets/database.svg"
          width={72}
          height={72}
          alt="Database"
          priority
        />
      </div>
      <h1 className="font-inter-var text-[1.125rem] font-medium !leading-6">
        {title}
      </h1>
      <p>{description}</p>
    </div>
  );
}

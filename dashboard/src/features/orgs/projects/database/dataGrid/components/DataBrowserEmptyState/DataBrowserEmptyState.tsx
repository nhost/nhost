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
      <h1 className="!leading-6 font-inter-var font-medium text-[1.125rem]">
        {title}
      </h1>
      <p>{description}</p>
    </div>
  );
}

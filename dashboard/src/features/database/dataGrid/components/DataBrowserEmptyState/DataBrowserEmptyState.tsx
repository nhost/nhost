import { Text } from '@/components/ui/v2/Text';
import Image from 'next/image';
import type { DetailedHTMLProps, HTMLProps, ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

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
      className={twMerge(
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

      <Text variant="h3" component="h1">
        {title}
      </Text>

      <Text>{description}</Text>
    </div>
  );
}

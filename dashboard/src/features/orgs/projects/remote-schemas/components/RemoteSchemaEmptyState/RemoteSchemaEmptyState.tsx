import { Anchor } from 'lucide-react';
import type { DetailedHTMLProps, HTMLProps, ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';
import { Text } from '@/components/ui/v2/Text';

export interface RemoteSchemaEmptyStateProps
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

export default function RemoteSchemaEmptyState({
  title,
  description,
  className,
  ...props
}: RemoteSchemaEmptyStateProps) {
  return (
    <div
      className={twMerge(
        'grid w-full place-content-center gap-2 px-4 py-16 text-center',
        className,
      )}
      {...props}
    >
      <div className="mx-auto">
        <Anchor className="h-12 w-12" />
      </div>

      <Text variant="h3" component="h1">
        {title}
      </Text>

      <Text>{description}</Text>
    </div>
  );
}

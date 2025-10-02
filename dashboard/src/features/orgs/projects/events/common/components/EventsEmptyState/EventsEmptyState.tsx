import { CalendarDays } from 'lucide-react';
import type { DetailedHTMLProps, HTMLProps, ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

export interface EventsEmptyStateProps
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

export default function EventsEmptyState({
  title,
  description,
  className,
  ...props
}: EventsEmptyStateProps) {
  return (
    <div
      className={twMerge(
        'grid w-full place-content-center gap-2 px-4 py-16 text-center',
        className,
      )}
      {...props}
    >
      <div className="mx-auto">
        <CalendarDays className="h-12 w-12" />
      </div>

      <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
        {title}
      </h3>

      <p className="leading-7 [&:not(:first-child)]:mt-6">{description}</p>
    </div>
  );
}

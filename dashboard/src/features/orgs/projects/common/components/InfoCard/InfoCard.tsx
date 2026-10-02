import { CopyIcon } from 'lucide-react';
import type { HTMLAttributes, ReactNode } from 'react';
import { Button } from '@/components/ui/v3/button';
import { cn } from '@/lib/utils';
import { copy } from '@/utils/copy';

export interface InfoCardProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * The title of the card.
   */
  title: string;
  /**
   * The description of the card.
   */
  value: string;
  /**
   * Include a copy button and functionality.
   * @default false
   */
  disableCopy?: boolean;
  /**
   * Pass a custom component to render the card as a value.
   */
  customValue?: ReactNode;
  /**
   * `stacked` renders the title above the value, keeping values aligned across
   * a list of cards.
   * @default 'inline'
   */
  layout?: 'inline' | 'stacked';
}

export default function InfoCard({
  title,
  value,
  disableCopy = false,
  customValue,
  layout = 'inline',
  className,
  ...props
}: InfoCardProps) {
  const copyButton = !disableCopy && (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-7 w-7 text-muted-foreground"
      onClick={(event) => {
        event.stopPropagation();
        copy(value, title);
      }}
      aria-label={`Copy ${title}`}
    >
      <CopyIcon className="h-4 w-4" />
    </Button>
  );

  if (layout === 'stacked') {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-2 rounded-lg bg-muted p-3 text-left shadow-sm',
          className,
        )}
        {...props}
      >
        <div className="grid min-w-0 gap-1">
          <span className="text-muted-foreground text-xs">{title}</span>

          {customValue || (
            <span className="truncate font-medium text-sm">{value}</span>
          )}
        </div>

        {copyButton}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'grid grid-flow-col place-content-between items-center gap-1 rounded-lg bg-muted p-3 shadow-sm',
        className,
      )}
      {...props}
    >
      <span className="font-medium text-sm+">{title}</span>

      <div className="grid grid-flow-col items-center gap-1 self-center">
        {customValue || (
          <span className="truncate font-medium text-sm">{value}</span>
        )}

        {copyButton}
      </div>
    </div>
  );
}

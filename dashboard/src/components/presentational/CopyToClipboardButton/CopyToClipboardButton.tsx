import { Copy } from 'lucide-react';
import { type MouseEvent, useEffect, useState } from 'react';
import { Button, type ButtonProps } from '@/components/ui/v3/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { cn, isNotEmptyValue } from '@/lib/utils';
import { copy } from '@/utils/copy';

// The copy button. Icon only, it is the subtle icon button (32 by 32) with a
// short tooltip ("Copy handler"). With children it is an outline Button with
// the copy icon and the label.
function CopyToClipboardButton({
  textToCopy,
  className,
  title,
  tooltip,
  children,
  ...props
}: {
  textToCopy?: string | null;
  /** Name shown in the "<title> copied to clipboard" toast. */
  title: string;
  /**
   * Short tooltip, one to three words (e.g. "Copy handler"). Leave it out
   * only when a parent already wraps the button in a tooltip.
   */
  tooltip?: string;
} & ButtonProps) {
  const [disabled, setDisabled] = useState(true);

  useEffect(() => {
    // Hide copy button if the browser does not support it
    if (typeof window !== 'undefined' && !navigator?.clipboard) {
      console.error(
        "The browser's Clipboard API is unavailable. The Clipboard API is only available on HTTPS.",
      );
      setDisabled(true);
    } else {
      setDisabled(false);
    }
  }, []);

  // Hide copy button if you would copy an empty string
  if (!textToCopy || disabled) {
    return null;
  }

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    copy(textToCopy, title);
  };

  if (isNotEmptyValue(children)) {
    return (
      <Button
        type="button"
        variant="outline"
        className={className}
        onClick={handleClick}
        {...props}
      >
        <Copy className="mr-2 h-4 w-4" />
        {children}
      </Button>
    );
  }

  const button = (
    <Button
      type="button"
      variant="subtle"
      size="icon-sm"
      className={cn('shrink-0', className)}
      onClick={handleClick}
      aria-label={tooltip ?? `Copy ${title}`}
      {...props}
    >
      <Copy className="h-4 w-4" />
    </Button>
  );

  if (!tooltip) {
    return button;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
export default CopyToClipboardButton;

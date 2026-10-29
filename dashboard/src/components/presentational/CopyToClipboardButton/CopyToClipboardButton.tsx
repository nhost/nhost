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
// "Copy <title>" tooltip. With children it is an outline Button with the copy
// icon and the label.
function CopyToClipboardButton({
  textToCopy,
  className,
  title,
  children,
  ...props
}: {
  textToCopy?: string | null;
  /**
   * Name of the copied value (e.g. "Handler URL"). Used in the "Copy <title>"
   * tooltip and accessible name, and in the "<title> copied to clipboard"
   * toast.
   */
  title: string;
} & Omit<ButtonProps, 'variant' | 'size'>) {
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
    // Inside a link, a click that isn't default-prevented also follows it.
    event.preventDefault();
    event.stopPropagation();

    copy(textToCopy, title);
  };

  const hasLabel = isNotEmptyValue(children);
  const label = `Copy ${title}`;

  const button = (
    <Button
      variant={hasLabel ? 'outline' : 'subtle'}
      className={cn({ 'shrink-0': !hasLabel }, className)}
      onClick={handleClick}
      aria-label={label}
      {...props}
    >
      <Copy className={cn({ 'mr-2': hasLabel })} />
      {children}
    </Button>
  );

  if (hasLabel) {
    return button;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
export default CopyToClipboardButton;

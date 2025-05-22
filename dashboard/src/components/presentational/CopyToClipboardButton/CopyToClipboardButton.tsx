import { Button, type ButtonProps } from '@/components/ui/v3/button';
import { isNotEmptyValue } from '@/lib/utils';
import { copy } from '@/utils/copy';
import { clsx } from 'clsx';
import { Copy } from 'lucide-react';
import { useEffect, useState } from 'react';

function CopyToClipboardButton({
  textToCopy,
  className,
  title,
  ...props
}: {
  textToCopy: string;
  title: string;
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
  const hasChildren = isNotEmptyValue(props.children);

  return (
    <Button
      type="button"
      size="icon"
      variant="outline"
      className={clsx(
        'group h-fit w-fit border-0 bg-transparent p-[2px] hover:bg-[#d6eefb] dark:hover:bg-[#1e2942]',
        className,
        { 'gap-3': hasChildren },
      )}
      onClick={(event) => {
        event.stopPropagation();

        copy(textToCopy, title);
      }}
      aria-label={textToCopy}
      {...props}
    >
      {props.children}
      <Copy className="top-5 h-4 w-4" />
    </Button>
  );
}
export default CopyToClipboardButton;

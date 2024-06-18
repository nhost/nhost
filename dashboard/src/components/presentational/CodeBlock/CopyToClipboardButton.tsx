import { clsx } from 'clsx';
import { useEffect, useState } from 'react';

import { CopyIcon } from '@/components/ui/v2/icons/CopyIcon';
import { copy } from '@/utils/copy';
import { IconButton, type IconButtonProps } from '@/components/ui/v2/IconButton';

export function CopyToClipboardButton({
  textToCopy,
  className,
  tooltipColor,
  title,
  ...props
}: {
  textToCopy: string;
  tooltipColor?: string;
  title: string;
} & IconButtonProps) {
  const [disabled, setDisabled] = useState(true);

  useEffect(() => {
    // Hide copy button if the browser does not support it
    if (typeof window !== "undefined" && !navigator?.clipboard) {
      console.error(
        "The browser's Clipboard API is unavailable. The Clipboard API is only available on HTTPS."
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

  return (
    <IconButton
      variant="borderless"
      color="secondary"
      className={clsx("group", className)}
      onClick={(event) => {
        event.stopPropagation();

        copy(textToCopy, title);
      }}
      aria-label={textToCopy}
      {...props}
    >
      <CopyIcon className="h-4 w-4 top-5" />
    </IconButton>
  );
}

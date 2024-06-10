import { clsx } from 'clsx';
import { type ComponentPropsWithoutRef, useEffect, useState } from 'react';

import { copyToClipboard, type CopyToClipboardResult } from './copyToClipboard';

import { Tooltip, tooltipClasses } from '@/components/ui/v2/Tooltip';

export function CopyToClipboardButton({
  textToCopy,
  onCopied,
  className,
  ...props
}: {
  textToCopy: string;
  onCopied?: (result: CopyToClipboardResult, textToCopy?: string) => void;
} & ComponentPropsWithoutRef<'button'>) {
  const [hidden, setHidden] = useState(true);
  const [disabled, setDisabled] = useState(true);

  useEffect(() => {
    // Hide copy button if the browser does not support it
    if (typeof window !== "undefined" && !navigator?.clipboard) {
      console.warn(
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
    <Tooltip
      title={hidden ? "Copy" : "Copied"}
      placement="top"
      slotProps={{
        popper: {
          sx: {
            [`&.${tooltipClasses.popper}[data-popper-placement*="bottom"] .${tooltipClasses.tooltip}`]:
            {
              marginTop: '0px',
            },
            [`&.${tooltipClasses.popper}[data-popper-placement*="top"] .${tooltipClasses.tooltip}`]:
            {
              marginBottom: '12px',
            },
          },
        },
      }}
    >
      <button
        type="button"
        aria-label="Copy code to clipboard"
        onClick={async () => {
          const result = await copyToClipboard(textToCopy);
          if (onCopied) {
            onCopied(result, textToCopy);
          }
          if (result === "success") {
            setHidden(false);
            setTimeout(() => {
              setHidden(true);
            }, 2000);
          }
        }}
        className={clsx("group", className)}
        {...props}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 384 512"
          className="top-5 h-[1.15rem] fill-slate-500 hover:fill-slate-300 cursor-pointer"
        >
          <path d="M320 64H280h-9.6C263 27.5 230.7 0 192 0s-71 27.5-78.4 64H104 64C28.7 64 0 92.7 0 128V448c0 35.3 28.7 64 64 64H320c35.3 0 64-28.7 64-64V128c0-35.3-28.7-64-64-64zM80 112v24c0 13.3 10.7 24 24 24h88 88c13.3 0 24-10.7 24-24V112h16c8.8 0 16 7.2 16 16V448c0 8.8-7.2 16-16 16H64c-8.8 0-16-7.2-16-16V128c0-8.8 7.2-16 16-16H80zm88-32a24 24 0 1 1 48 0 24 24 0 1 1 -48 0zM136 272a24 24 0 1 0 -48 0 24 24 0 1 0 48 0zm40-16c-8.8 0-16 7.2-16 16s7.2 16 16 16h96c8.8 0 16-7.2 16-16s-7.2-16-16-16H176zm0 96c-8.8 0-16 7.2-16 16s7.2 16 16 16h96c8.8 0 16-7.2 16-16s-7.2-16-16-16H176zm-64 40a24 24 0 1 0 0-48 24 24 0 1 0 0 48z" />
        </svg>
      </button>
    </Tooltip>
  );
}

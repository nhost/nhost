import Link from 'next/link';
import { type ReactElement, useEffect, useRef, useState } from 'react';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';

interface SeverityPlanHelpProps {
  children: ReactElement;
  severity: string;
  explanation: string;
  billingHref?: string;
  disabled?: boolean;
}

// Use an interactive popover for this hover card so the billing link remains
// reachable with Tab and the same information can be opened on touch screens.
export default function SeverityPlanHelp({
  children,
  severity,
  explanation,
  billingHref,
  disabled,
}: SeverityPlanHelpProps) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  function cancelClose() {
    clearTimeout(closeTimer.current);
  }
  function show() {
    cancelClose();
    if (!disabled) {
      setOpen(true);
    }
  }
  function closeLater() {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      if (
        !trigger.current?.contains(document.activeElement) &&
        !content.current?.contains(document.activeElement)
      ) {
        setOpen(false);
      }
    }, 300);
  }
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  useEffect(() => {
    if (disabled) {
      setOpen(false);
    }
  }, [disabled]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div
        ref={trigger}
        className="relative h-full"
        onPointerEnter={show}
        onPointerLeave={closeLater}
        onFocusCapture={show}
        onBlurCapture={closeLater}
      >
        <PopoverAnchor asChild>{children}</PopoverAnchor>
        <PopoverTrigger asChild>
          <button
            ref={button}
            type="button"
            disabled={disabled}
            aria-label={`${severity} plan availability`}
            className="absolute inset-0 cursor-help rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
            onClick={(event) => {
              event.preventDefault();
              show();
            }}
            onKeyDown={(event) => {
              const link = content.current?.querySelector('a');
              if (event.key === 'Tab' && !event.shiftKey && link) {
                event.preventDefault();
                link.focus();
              }
            }}
          />
        </PopoverTrigger>
      </div>
      <PopoverContent
        ref={content}
        aria-label={`${severity} plan availability`}
        className="space-y-3 text-sm"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => {
          event.preventDefault();
          button.current?.focus();
          setOpen(false);
        }}
        onPointerEnter={cancelClose}
        onPointerLeave={closeLater}
        onFocusCapture={cancelClose}
        onBlurCapture={closeLater}
      >
        <p>{explanation}</p>
        {billingHref && (
          <Link
            href={billingHref}
            className="inline-block rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            See plans
          </Link>
        )}
      </PopoverContent>
    </Popover>
  );
}

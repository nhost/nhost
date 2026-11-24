import Link from 'next/link';
import { type ReactElement, useEffect, useRef, useState } from 'react';
import OrganizationPlanBadge from '@/components/layout/Header/OrganizationPlanBadge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';

interface SeverityPlanHelpProps {
  children: ReactElement;
  severity: string;
  explanation: string;
  plansIntro: string;
  accessibleDescription: string;
  billingHref?: string;
  onSeePlans?: VoidFunction;
  disabled?: boolean;
}

// Use an interactive popover for this hover card so the billing link remains
// reachable with Tab and the same information can be opened on touch screens.
export default function SeverityPlanHelp({
  children,
  severity,
  explanation,
  plansIntro,
  accessibleDescription,
  billingHref,
  onSeePlans,
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
        {children}
        <PopoverTrigger asChild>
          <button
            ref={button}
            type="button"
            disabled={disabled}
            aria-label={`${severity} plan availability`}
            aria-description={accessibleDescription}
            className="absolute inset-0 cursor-help rounded-md hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:hover:bg-transparent"
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
        side="top"
        align="center"
        className="space-y-3 text-muted-foreground text-sm"
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
        <p>
          {explanation}
          <br />
          {plansIntro}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1">
            <OrganizationPlanBadge plan="Team" />
            <OrganizationPlanBadge plan="Enterprise" />
          </div>
          {billingHref && (
            <Link
              href={billingHref}
              onClick={(event) => {
                if (
                  !onSeePlans ||
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey
                ) {
                  return;
                }
                event.preventDefault();
                setOpen(false);
                onSeePlans();
              }}
              className="ml-auto inline-block rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              See plans
            </Link>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

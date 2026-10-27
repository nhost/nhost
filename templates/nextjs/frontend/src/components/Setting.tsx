'use client';

import { type ReactNode, useState } from 'react';
import Dialog from '@/components/Dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** The rows of the account page's settings. */
export function SettingsList({ children }: { children: ReactNode }) {
  return <ul className="divide-y">{children}</ul>;
}

export function SettingRow({
  label,
  value,
  children,
}: {
  label: string;
  value: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className="flex min-h-14 items-center gap-3 px-5 py-2 text-sm">
      <span className="w-24 shrink-0 font-medium sm:w-30">{label}</span>
      {/* min-w-0 so a long address truncates rather than pushing the button
          off the row. */}
      <span className="min-w-0 flex-1 truncate text-muted-foreground">
        {value}
      </span>
      {children}
    </li>
  );
}

/** A row whose button opens a dialog with `children` in it. */
export function DialogSetting({
  label,
  value,
  action,
  title,
  description,
  destructive = false,
  open: givenOpen,
  onOpenChange,
  onOpen,
  children,
}: {
  label: string;
  value: ReactNode;
  action: string;
  title: string;
  description?: ReactNode;
  destructive?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Called as the row's button opens the dialog. */
  onOpen?: VoidFunction;
  children: ReactNode;
}) {
  const [ownOpen, setOwnOpen] = useState(false);
  const open = givenOpen ?? ownOpen;
  const setOpen = onOpenChange ?? setOwnOpen;

  return (
    <SettingRow label={label} value={value}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-haspopup="dialog"
        className={cn(
          'shrink-0',
          destructive && 'text-destructive hover:text-destructive',
        )}
        onClick={() => {
          onOpen?.();
          setOpen(true);
        }}
      >
        {action}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
      >
        {children}
      </Dialog>
    </SettingRow>
  );
}

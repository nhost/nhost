'use client';

import { createContext, type ReactNode, use, useId, useState } from 'react';
import Collapse from '@/components/Collapse';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * The rows of the account page's sign-in settings.
 *
 * Each row is what is set now and a button to change it, which opens the form
 * in place rather than leading to a page: the forms behind them are a field
 * or two each, and a page per form meant leaving the account and finding the
 * way back for every one. One row is open at a time, so the list never grows
 * into a column of forms; opening one closes whichever was open.
 */

const OpenRow = createContext<
  [string | undefined, (id: string | undefined) => void] | null
>(null);

export function SettingsList({ children }: { children: ReactNode }) {
  const open = useState<string | undefined>();

  return (
    <OpenRow value={open}>
      <ul className="divide-y rounded-md border">{children}</ul>
    </OpenRow>
  );
}

/**
 * Whether the row `id` is the open one, and a way to open or close it.
 *
 * For a row whose form has to close it, such as two-factor once the code is
 * accepted. Outside a `SettingsList` each caller keeps its own state, so a
 * row only closes itself from inside one.
 */
export function useSettingOpen(id: string): [boolean, (open: boolean) => void] {
  const list = use(OpenRow);
  const [own, setOwn] = useState(false);

  if (!list) {
    return [own, setOwn];
  }

  const [openId, setOpenId] = list;
  return [
    openId === id,
    (open) => setOpenId(open ? id : openId === id ? undefined : openId),
  ];
}

export function ExpandableSetting({
  id: givenId,
  label,
  value,
  action,
  onOpen,
  children,
}: {
  /** Pass the id given to `useSettingOpen` when the row closes itself. */
  id?: string;
  label: string;
  value: ReactNode;
  action: string;
  /** Called as the row is opened by its link. */
  onOpen?: () => void;
  children: ReactNode;
}) {
  const ownId = useId();
  const id = givenId ?? ownId;
  const panelId = `${id}-panel`;
  const [open, setOpen] = useSettingOpen(id);

  return (
    <li className="group">
      <div className="flex items-center gap-4 px-4 py-2 text-sm">
        <span className="w-24 shrink-0 font-medium">{label}</span>
        {/* min-w-0 so a long address truncates rather than pushing the
            button off the row. */}
        <span className="min-w-0 flex-1 truncate text-muted-foreground">
          {value}
        </span>
        {/* Only the button opens the row, not the row itself, so reading
            across one never opens it by accident.

            It shows on hover or focus, so the list reads as what is set
            rather than as a column of buttons, and stays while the row is
            open, as the caret that closes it. A screen without hover, such
            as a phone, has no way to reveal it, so there it always shows.
            Faded rather than removed, so the row keeps its height and the
            button its place.

            Open, it shrinks to a square around the caret. It is the last
            thing in the row, so its right edge stays put and the caret sits
            where the text ended. */}
        <Button
          type="button"
          variant="ghost"
          size={open ? 'icon' : 'sm'}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? `Close: ${action}` : undefined}
          className={cn(
            'shrink-0 transition-[opacity,background-color] duration-300 ease-in-out focus-visible:opacity-100 group-hover:opacity-100 motion-reduce:transition-none [@media(hover:none)]:opacity-100',
            open ? 'size-8 opacity-100' : 'opacity-0',
          )}
          onClick={() => {
            if (!open) {
              onOpen?.();
            }
            setOpen(!open);
          }}
        >
          {open ? (
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4"
            >
              <path d="m4 10 4-4 4 4" />
            </svg>
          ) : (
            action
          )}
        </Button>
      </div>
      <Collapse id={panelId} open={open}>
        <div className="px-4 pt-2 pb-4">{children}</div>
      </Collapse>
    </li>
  );
}

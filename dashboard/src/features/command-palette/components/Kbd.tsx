import type { ReactNode } from 'react';

interface KbdProps {
  children: ReactNode;
}

export const Kbd = ({ children }: KbdProps) => (
  <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border bg-muted px-1 font-sans text-[11px] text-muted-foreground">
    {children}
  </kbd>
);

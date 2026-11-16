import type { ReactNode } from 'react';

interface AreaSidebarLayoutProps {
  /** The page's navigation, usually an `AreaSidebarRoot`. */
  sidebar: ReactNode;
  children: ReactNode;
}

/**
 * A project area page with its own navigation (settings, backups, ...):
 * navigation on the left, content on the right. On desktop the screen is
 * split into two columns that together fill the width, the navigation
 * right-aligned in the left column and the content left-aligned in the right
 * one. The outer `1fr` tracks share the spare width, so the navigation and
 * content stay centred as one block, while the right column, and with it the
 * scrollbar, reaches the screen edge. Only the right column scrolls, so the
 * navigation stays in view.
 *
 * On mobile the navigation sits above the content and stays in view; only the
 * content scrolls.
 */
export default function AreaSidebarLayout({
  sidebar,
  children,
}: AreaSidebarLayoutProps) {
  return (
    <div className="flex h-full flex-col md:grid md:grid-cols-[1fr_14rem_minmax(0,58rem)_1fr] md:grid-rows-[minmax(0,1fr)]">
      <div className="shrink-0 py-4 md:col-span-2 md:flex md:min-h-0 md:justify-end md:py-8">
        {sidebar}
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto md:col-span-2 md:pt-8">
        <div className="max-w-[58rem] pb-8">{children}</div>
      </div>
    </div>
  );
}

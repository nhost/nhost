import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

/** The small uppercase heading above a group of sidebar items. */
export default function SidebarSectionTitle({
  className,
  ...props
}: ComponentPropsWithoutRef<'h2'>) {
  return (
    <h2
      className={cn(
        'mb-1 px-2 font-normal text-2xs text-muted-foreground uppercase tracking-[0.08em] dark:text-sidebar-section-title',
        className,
      )}
      {...props}
    />
  );
}

import Link from 'next/link';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface RouteTabsProps
  extends Omit<ComponentPropsWithoutRef<'nav'>, 'aria-label' | 'children'> {
  'aria-label': string;
  children: ReactNode;
  listClassName?: string;
}

export function RouteTabs({
  children,
  className,
  listClassName,
  ...props
}: RouteTabsProps) {
  return (
    <nav className={cn('overflow-x-auto', className)} {...props}>
      <div
        className={cn(
          'inline-flex h-10 items-center justify-start gap-6 text-muted-foreground',
          listClassName,
        )}
      >
        {children}
      </div>
    </nav>
  );
}

export interface RouteTabLinkProps
  extends Omit<ComponentPropsWithoutRef<typeof Link>, 'aria-current'> {
  active?: boolean;
  disabled?: boolean;
}

export function RouteTabLink({
  active,
  children,
  className,
  disabled,
  href,
  ...props
}: RouteTabLinkProps) {
  const tabClassName = cn(
    'inline-flex h-10 items-center justify-center whitespace-nowrap border-transparent border-b-2 px-0 font-medium text-sm ring-offset-background transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=active]:border-primary data-[state=active]:text-primary',
    disabled && 'pointer-events-none opacity-50 hover:text-muted-foreground',
    className,
  );

  if (disabled) {
    return (
      <span
        aria-current={active ? 'page' : undefined}
        aria-disabled="true"
        className={tabClassName}
        data-state={active ? 'active' : 'inactive'}
      >
        {children}
      </span>
    );
  }

  return (
    <Link
      aria-current={active ? 'page' : undefined}
      className={tabClassName}
      data-state={active ? 'active' : 'inactive'}
      href={href}
      {...props}
    >
      {children}
    </Link>
  );
}

export function RouteTabSeparator({
  className,
  ...props
}: ComponentPropsWithoutRef<'span'>) {
  return (
    <span
      aria-hidden="true"
      className={cn('h-5 w-px shrink-0 bg-border', className)}
      {...props}
    />
  );
}

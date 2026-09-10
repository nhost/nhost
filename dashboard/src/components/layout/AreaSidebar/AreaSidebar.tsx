import Link from 'next/link';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface AreaSidebarRootProps
  extends Omit<ComponentPropsWithoutRef<'aside'>, 'children'> {
  children: ReactNode;
}

export function AreaSidebarRoot({
  children,
  className,
  ...props
}: AreaSidebarRootProps) {
  return (
    <aside
      className={cn('h-full w-56 shrink-0 overflow-auto', className)}
      {...props}
    >
      {children}
    </aside>
  );
}

export interface AreaSidebarNavProps
  extends Omit<ComponentPropsWithoutRef<'nav'>, 'aria-label' | 'children'> {
  ariaLabel: string;
  children: ReactNode;
}

export function AreaSidebarNav({
  ariaLabel,
  children,
  className,
  ...props
}: AreaSidebarNavProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn('flex h-full min-h-0 flex-col gap-6 px-4 py-6', className)}
      {...props}
    >
      {children}
    </nav>
  );
}

export interface AreaSidebarGroupProps
  extends Omit<ComponentPropsWithoutRef<'section'>, 'children'> {
  children: ReactNode;
  label?: string;
  labelClassName?: string;
  listClassName?: string;
}

export function AreaSidebarGroup({
  children,
  className,
  label,
  labelClassName,
  listClassName,
  ...props
}: AreaSidebarGroupProps) {
  return (
    <section className={className} {...props}>
      {label && (
        <h2
          className={cn(
            'px-3 pb-2 font-semibold text-2xs text-muted-foreground uppercase tracking-[0.16em]',
            labelClassName,
          )}
        >
          {label}
        </h2>
      )}
      <ul className={cn('flex flex-col gap-1', listClassName)}>{children}</ul>
    </section>
  );
}

const areaSidebarItemClassName =
  'flex h-10 w-full items-center rounded-lg px-3 font-medium text-muted-foreground text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

interface AreaSidebarItemProps {
  active?: boolean;
  className?: string;
  disabled?: boolean;
}

function getAreaSidebarItemClassName({
  active,
  className,
  disabled,
}: AreaSidebarItemProps) {
  return cn(
    areaSidebarItemClassName,
    active && 'bg-muted text-primary hover:bg-muted hover:text-primary',
    disabled &&
      'cursor-not-allowed opacity-50 hover:bg-transparent hover:text-muted-foreground',
    className,
  );
}

export interface AreaSidebarLinkProps
  extends Omit<ComponentPropsWithoutRef<typeof Link>, 'aria-current'> {
  active?: boolean;
  disabled?: boolean;
  itemClassName?: string;
}

export function AreaSidebarLink({
  active,
  children,
  className,
  disabled,
  href,
  itemClassName,
  ...props
}: AreaSidebarLinkProps) {
  const linkClassName = getAreaSidebarItemClassName({
    active,
    className: itemClassName,
    disabled,
  });

  return (
    <li className={className}>
      {disabled ? (
        <span
          aria-current={active ? 'page' : undefined}
          aria-disabled="true"
          className={linkClassName}
        >
          {children}
        </span>
      ) : (
        <Link
          aria-current={active ? 'page' : undefined}
          className={linkClassName}
          href={href}
          {...props}
        >
          {children}
        </Link>
      )}
    </li>
  );
}

export interface AreaSidebarButtonProps
  extends ComponentPropsWithoutRef<'button'> {
  active?: boolean;
  itemClassName?: string;
}

export function AreaSidebarButton({
  active,
  children,
  className,
  disabled,
  itemClassName,
  type = 'button',
  ...props
}: AreaSidebarButtonProps) {
  return (
    <li className={className}>
      <button
        aria-current={active ? 'page' : undefined}
        className={getAreaSidebarItemClassName({
          active,
          className: itemClassName,
          disabled,
        })}
        disabled={disabled}
        type={type}
        {...props}
      >
        {children}
      </button>
    </li>
  );
}

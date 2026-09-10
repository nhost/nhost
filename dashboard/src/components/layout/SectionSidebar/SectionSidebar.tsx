import Link from 'next/link';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { dashboardNavItemTextClassName } from '@/components/layout/DashboardSidebar/DashboardSidebar';
import { cn } from '@/lib/utils';

export interface SectionSidebarNavProps
  extends Omit<ComponentPropsWithoutRef<'nav'>, 'aria-label' | 'children'> {
  ariaLabel: string;
  children: ReactNode;
}

export function SectionSidebarNav({
  ariaLabel,
  children,
  className,
  ...props
}: SectionSidebarNavProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn('flex h-full min-h-0 flex-col overflow-y-auto p-2', className)}
      {...props}
    >
      {children}
    </nav>
  );
}

export interface SectionSidebarGroupProps
  extends Omit<ComponentPropsWithoutRef<'section'>, 'children'> {
  children: ReactNode;
  label?: string;
  labelClassName?: string;
  listClassName?: string;
}

export function SectionSidebarGroup({
  children,
  className,
  label,
  labelClassName,
  listClassName,
  ...props
}: SectionSidebarGroupProps) {
  return (
    <section className={cn('mt-6 first:mt-0', className)} {...props}>
      {label && (
        <h2
          className={cn(
            'px-2 mb-1 text-[10px] font-normal uppercase tracking-[0.08em] text-muted-foreground dark:text-sidebar-section-title',
            labelClassName,
          )}
        >
          {label}
        </h2>
      )}
      <ul className={cn('flex flex-col', listClassName)}>{children}</ul>
    </section>
  );
}

const sectionSidebarItemClassName = cn(
  'flex w-full items-center justify-start gap-2.5 rounded-md px-2 py-1.5',
  dashboardNavItemTextClassName,
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
);

interface SectionSidebarItemProps {
  active?: boolean;
  className?: string;
  disabled?: boolean;
}

function getSectionSidebarItemClassName({
  active,
  className,
  disabled,
}: SectionSidebarItemProps) {
  return cn(
    sectionSidebarItemClassName,
    active &&
      'bg-neutral-100 text-primary hover:bg-neutral-100 hover:text-primary dark:bg-muted dark:text-primary dark:hover:bg-muted dark:hover:text-primary',
    disabled &&
      'cursor-not-allowed opacity-50 hover:bg-transparent hover:text-neutral-600 dark:hover:bg-transparent dark:hover:text-muted-foreground',
    className,
  );
}

export interface SectionSidebarLinkProps
  extends Omit<ComponentPropsWithoutRef<typeof Link>, 'aria-current'> {
  active?: boolean;
  disabled?: boolean;
  itemClassName?: string;
}

export function SectionSidebarLink({
  active,
  children,
  className,
  disabled,
  href,
  itemClassName,
  ...props
}: SectionSidebarLinkProps) {
  const linkClassName = getSectionSidebarItemClassName({
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

export interface SectionSidebarButtonProps
  extends ComponentPropsWithoutRef<'button'> {
  active?: boolean;
  itemClassName?: string;
}

export function SectionSidebarButton({
  active,
  children,
  className,
  disabled,
  itemClassName,
  type = 'button',
  ...props
}: SectionSidebarButtonProps) {
  return (
    <li className={className}>
      <button
        aria-current={active ? 'page' : undefined}
        className={getSectionSidebarItemClassName({
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

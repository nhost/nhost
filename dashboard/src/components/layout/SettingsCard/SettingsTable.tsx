import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * A tabular layout for use inside a SettingsCard: a header row plus a list
 * of data rows, all sharing one horizontal inset (px-6, matching
 * SettingsCardHeader) so the row dividers stop short of the card's own
 * edges instead of touching them.
 *
 * This is a different pattern from the org Members list, whose table IS
 * the page's own container and is meant to span edge to edge. This one
 * lives nested inside another bordered container (the SettingsCard), so
 * it needs its own gutter instead.
 */
export interface SettingsTableProps
  extends React.HTMLAttributes<HTMLDivElement> {}

const SettingsTable = React.forwardRef<HTMLDivElement, SettingsTableProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('px-6', className)} {...props} />
  ),
);
SettingsTable.displayName = 'SettingsTable';

export interface SettingsTableHeaderProps
  extends React.HTMLAttributes<HTMLDivElement> {}

const SettingsTableHeader = React.forwardRef<
  HTMLDivElement,
  SettingsTableHeaderProps
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('border-b-1 px-4 py-3', className)}
    {...props}
  />
));
SettingsTableHeader.displayName = 'SettingsTableHeader';

export interface SettingsTableBodyProps
  extends React.HTMLAttributes<HTMLDivElement> {}

const SettingsTableBody = React.forwardRef<
  HTMLDivElement,
  SettingsTableBodyProps
>(({ className, ...props }, ref) => (
  // border-b-1 closes off the bottom of the list with the same kind of
  // line SettingsTableHeader draws above it, so the last row doesn't
  // look like it's left hanging open.
  <div ref={ref} className={cn('divide-y border-b-1', className)} {...props} />
));
SettingsTableBody.displayName = 'SettingsTableBody';

export interface SettingsTableRowProps
  extends React.HTMLAttributes<HTMLDivElement> {}

const SettingsTableRow = React.forwardRef<HTMLDivElement, SettingsTableRowProps>(
  ({ className, ...props }, ref) => (
    // Same row hover as the org Members list: a subtle background tint,
    // no border/shadow change, so it reads consistently across every
    // table built on these primitives.
    // min-h-14 gives every row the same floor height regardless of what
    // it holds (plain text vs. a button vs. an icon-button pair), so rows
    // don't visibly vary in height depending on their content.
    <div
      ref={ref}
      className={cn(
        'flex min-h-14 items-center px-4 py-3 transition-colors hover:bg-muted/60',
        className,
      )}
      {...props}
    />
  ),
);
SettingsTableRow.displayName = 'SettingsTableRow';

export {
  SettingsTable,
  SettingsTableHeader,
  SettingsTableBody,
  SettingsTableRow,
};

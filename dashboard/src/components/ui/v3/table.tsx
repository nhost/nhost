import type * as React from 'react';

import { cn } from '@/lib/utils';

const Table = ({
  className,
  containerClassName,
  ref,
  ...props
}: React.HTMLAttributes<HTMLTableElement> & {
  containerClassName?: HTMLDivElement['className'];
} & { ref?: React.Ref<HTMLTableElement> }) => (
  <div className={cn('relative w-full overflow-auto', containerClassName)}>
    <table
      ref={ref}
      className={cn('w-full caption-bottom text-sm', className)}
      {...props}
    />
  </div>
);

const TableHeader = ({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement> & {
  ref?: React.Ref<HTMLTableSectionElement>;
}) => (
  <thead ref={ref} className={cn('[&_tr]:border-b', className)} {...props} />
);

const TableBody = ({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement> & {
  ref?: React.Ref<HTMLTableSectionElement>;
}) => (
  <tbody
    ref={ref}
    className={cn('[&_tr:last-child]:border-0', className)}
    {...props}
  />
);

const TableFooter = ({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement> & {
  ref?: React.Ref<HTMLTableSectionElement>;
}) => (
  <tfoot
    ref={ref}
    className={cn(
      'border-t bg-muted/50 font-medium [&>tr]:last:border-b-0',
      className,
    )}
    {...props}
  />
);

const TableRow = ({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & {
  ref?: React.Ref<HTMLTableRowElement>;
}) => (
  <tr
    ref={ref}
    className={cn(
      'border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted',
      className,
    )}
    {...props}
  />
);

const TableHead = ({
  className,
  ref,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & {
  ref?: React.Ref<HTMLTableCellElement>;
}) => (
  <th
    ref={ref}
    className={cn(
      'h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0',
      className,
    )}
    {...props}
  />
);

const TableCell = ({
  className,
  ref,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & {
  ref?: React.Ref<HTMLTableCellElement>;
}) => (
  <td
    ref={ref}
    className={cn('p-4 align-middle [&:has([role=checkbox])]:pr-0', className)}
    {...props}
  />
);

const TableCaption = ({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLTableCaptionElement> & {
  ref?: React.Ref<HTMLTableCaptionElement>;
}) => (
  <caption
    ref={ref}
    className={cn('mt-4 text-muted-foreground text-sm', className)}
    {...props}
  />
);

export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
};

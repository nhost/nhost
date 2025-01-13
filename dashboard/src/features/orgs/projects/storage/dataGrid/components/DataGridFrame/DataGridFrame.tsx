import { useDataGridConfig } from '@/features/orgs/projects/storage/dataGrid/components/DataGridConfigProvider';
import clsx from 'clsx';
import type { DetailedHTMLProps, HTMLProps } from 'react';

export type DataGridFrameProps = DetailedHTMLProps<
  HTMLProps<HTMLDivElement>,
  HTMLDivElement
>;

export default function DataGridFrame<T extends object>({
  style,
  children,
  className,
  ...props
}: DataGridFrameProps) {
  const { getTableProps } = useDataGridConfig<T>();
  const { style: reactTableStyle, ...restTableProps } = getTableProps();

  return (
    <div
      {...restTableProps}
      {...props}
      className={clsx('min-w-min', className)}
      style={{ ...reactTableStyle, minWidth: undefined, ...style }}
    >
      {children}
    </div>
  );
}

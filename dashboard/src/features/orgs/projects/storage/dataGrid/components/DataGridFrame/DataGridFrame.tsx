import clsx from 'clsx';
import type { DetailedHTMLProps, HTMLProps } from 'react';

export type DataGridFrameProps = DetailedHTMLProps<
  HTMLProps<HTMLDivElement>,
  HTMLDivElement
>;

export default function DataGridFrame({
  style,
  children,
  className,
  ...props
}: DataGridFrameProps) {
  return (
    <div
      {...props}
      className={clsx('min-w-min', className)}
      style={{ ...style }}
    >
      {children}
    </div>
  );
}

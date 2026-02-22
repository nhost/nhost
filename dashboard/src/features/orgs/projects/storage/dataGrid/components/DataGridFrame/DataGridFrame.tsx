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
    // biome-ignore lint/a11y/useSemanticElements: div based table
    <div
      {...props}
      className={clsx('min-w-min', className)}
      style={{ ...style }}
      role="table"
    >
      {children}
    </div>
  );
}

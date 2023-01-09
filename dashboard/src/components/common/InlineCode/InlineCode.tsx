import type { DetailedHTMLProps, HTMLProps } from 'react';
import { twMerge } from 'tailwind-merge';

export interface InlineCodeProps
  extends DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement> {}

function InlineCode({ className, children, ...props }: InlineCodeProps) {
  return (
    <code
      className={twMerge(
        'inline-grid max-w-xs items-center truncate rounded-sm bg-gray-100 px-1 font-mono text-[11px] text-greyscaleMedium',
        className,
      )}
      {...props}
    >
      {children}
    </code>
  );
}

export default InlineCode;

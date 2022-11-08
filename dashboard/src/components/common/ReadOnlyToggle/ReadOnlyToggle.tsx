import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';
import { twMerge } from 'tailwind-merge';

const ReadOnlyToggle = forwardRef(
  (
    { checked }: { checked: boolean | null },
    ref: ForwardedRef<HTMLSpanElement>,
  ) => (
    <span
      className="inline-grid h-full w-full grid-flow-col items-center justify-start gap-1.5"
      ref={ref}
    >
      <span
        className={twMerge(
          'box-border inline-grid h-3 w-5 items-center rounded-full px-0.5',
          checked === true && 'justify-end bg-greyscaleDark',
          checked === false && 'border-1 border-greyscaleDark',
          checked === null && 'border-1 border-greyscaleDark',
        )}
      >
        <span
          className={twMerge(
            'inline rounded-full',
            checked === true && 'h-2 w-2 bg-white',
            checked === false && 'h-2 w-2 bg-greyscaleDark',
            checked === null && 'h-px w-2 justify-self-center bg-greyscaleDark',
          )}
        />
      </span>

      <span className="truncate text-xs font-normal">{String(checked)}</span>
    </span>
  ),
);

ReadOnlyToggle.displayName = 'NhostReadOnlyToggle';

export default ReadOnlyToggle;

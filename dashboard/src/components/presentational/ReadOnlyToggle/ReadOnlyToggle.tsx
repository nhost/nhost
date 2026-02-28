import type {
  DetailedHTMLProps,
  ForwardedRef,
  HTMLAttributes,
  HTMLProps,
} from 'react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export type ReadOnlyToggleProps = Omit<
  DetailedHTMLProps<HTMLProps<HTMLSpanElement>, HTMLSpanElement>,
  'checked'
> & {
  /**
   * Determines whether the toggle is checked or not.
   */
  checked?: boolean | null;
  /**
   * Props passed to specific component slots.
   */
  slotProps?: {
    /**
     * Props passed to the root `<span />` element.
     */
    root?: DetailedHTMLProps<HTMLProps<HTMLSpanElement>, HTMLSpanElement>;
    /**
     * Props passed to the label.
     */
    label?: HTMLAttributes<HTMLSpanElement>;
  };
};

function ReadOnlyToggle(
  { checked, className, slotProps = {}, ...props }: ReadOnlyToggleProps,
  ref: ForwardedRef<HTMLSpanElement>,
) {
  return (
    <span
      {...props}
      {...(slotProps?.root || {})}
      className={cn(
        'inline-grid h-full w-full grid-flow-col items-center justify-start gap-1.5',
        slotProps?.root?.className,
        className,
      )}
      ref={ref}
    >
      <span
        className={cn(
          'box-border inline-grid h-3 w-5 items-center rounded-full border-1 border-primary-text bg-transparent px-0.5',
          checked && 'justify-end',
          {
            'border-transparent bg-primary-text px-0.5 dark:bg-[#363a43]':
              checked,
          },
        )}
      >
        <span
          className={cn(
            'inline-block h-2 w-2 rounded-full border-primary-text bg-primary-text',
            {
              'border-transparent bg-data-cell-bg px-0.5 dark:bg-[#f4f7f9]':
                checked,
              'my-px h-px justify-self-center': checked === null,
            },
          )}
        />
      </span>

      <span
        {...(slotProps?.label || {})}
        className={cn(
          '!text-xs truncate font-normal',
          slotProps?.label?.className,
        )}
      >
        {String(checked)}
      </span>
    </span>
  );
}

ReadOnlyToggle.displayName = 'NhostReadOnlyToggle';

export default forwardRef(ReadOnlyToggle);

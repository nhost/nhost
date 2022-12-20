import type { TextProps } from '@/ui/v2/Text';
import Text from '@/ui/v2/Text';
import type { DetailedHTMLProps, ForwardedRef, HTMLProps } from 'react';
import { forwardRef } from 'react';
import { twMerge } from 'tailwind-merge';

export interface ReadOnlyToggleProps
  extends DetailedHTMLProps<HTMLProps<HTMLSpanElement>, HTMLSpanElement> {
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
    label?: TextProps;
  };
}

function ReadOnlyToggle(
  { checked, className, slotProps = {}, ...props }: ReadOnlyToggleProps,
  ref: ForwardedRef<HTMLSpanElement>,
) {
  return (
    <span
      {...props}
      {...(slotProps?.root || {})}
      className={twMerge(
        'inline-grid h-full w-full grid-flow-col items-center justify-start gap-1.5',
        slotProps?.root?.className,
        className,
      )}
      ref={ref}
    >
      <span
        className={twMerge(
          'box-border inline-grid h-3 w-5 items-center rounded-full px-0.5',
          checked === true &&
            'border-1 border-transparent justify-end bg-greyscaleDark',
          checked === false && 'border-1 border-greyscaleDark',
          checked === null && 'border-1 border-greyscaleDark',
        )}
      >
        <span
          className={twMerge(
            'inline-block rounded-full',
            checked === true && 'h-2 w-2 bg-white',
            checked === false && 'h-2 w-2 bg-greyscaleDark',
            checked === null &&
              'h-px my-px w-2 justify-self-center bg-greyscaleDark',
          )}
        />
      </span>

      <Text
        {...(slotProps?.label || {})}
        component="span"
        className={twMerge(
          'truncate !text-xs font-normal',
          slotProps?.label?.className,
        )}
      >
        {String(checked)}
      </Text>
    </span>
  );
}

ReadOnlyToggle.displayName = 'NhostReadOnlyToggle';

export default forwardRef(ReadOnlyToggle);

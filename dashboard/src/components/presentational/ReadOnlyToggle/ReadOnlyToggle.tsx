import { Box } from '@/components/ui/v2/Box';
import type { TextProps } from '@/components/ui/v2/Text';
import { Text } from '@/components/ui/v2/Text';
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
      <Box
        component="span"
        sx={{
          backgroundColor: (theme) => {
            if (checked) {
              return theme.palette.mode === 'dark' ? 'grey.400' : 'grey.700';
            }

            return 'transparent';
          },
          borderColor: checked ? 'transparent' : 'grey.700',
        }}
        className={twMerge(
          'box-border inline-grid h-3 w-5 items-center rounded-full border-1 px-0.5',
          checked === true && 'justify-end',
        )}
      >
        <Box
          component="span"
          sx={{
            backgroundColor: (theme) => {
              if (checked) {
                return theme.palette.mode === 'dark' ? 'grey.700' : 'grey.200';
              }

              return 'grey.700';
            },
          }}
          className={twMerge(
            'inline-block h-2 w-2 rounded-full',
            checked === null && 'my-px h-px justify-self-center',
          )}
        />
      </Box>

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

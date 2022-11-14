import type { ForwardedRef, PropsWithChildren } from 'react';
import { forwardRef } from 'react';

export interface TooltipProps extends PropsWithChildren<unknown> {
  /**
   * Title of the tooltip.
   */
  title: string;
  /**
   * Determine if the tooltip should be shown.
   */
  disabled?: boolean;
}

export const Tooltip = forwardRef(
  (
    { title, children, disabled }: TooltipProps,
    ref: ForwardedRef<HTMLDivElement>,
  ) => (
    <div className="group relative" ref={ref}>
      {children}

      {!disabled && (
        <div className="absolute left-2 bottom-1 z-50 hidden group-hover:block">
          <svg
            className="absolute -top-2 left-3 z-50 mr-3 h-3 w-3 -rotate-180 transform text-greyscaleDark"
            x="0px"
            y="0px"
            viewBox="0 0 255 255"
            xmlSpace="preserve"
          >
            <polygon
              className="border border-greyscaleDark fill-current text-greyscaleDark"
              points="0,0 127.5,127.5 255,0"
            />
          </svg>

          <div className="text-sharp absolute left-0 z-50 mt-1 w-40 origin-top-left rounded-md bg-greyscaleDark p-2 font-display text-sm- font-medium text-white shadow-2xl">
            {title}
          </div>
        </div>
      )}
    </div>
  ),
);

Tooltip.displayName = 'NhostTooltip';

export default Tooltip;

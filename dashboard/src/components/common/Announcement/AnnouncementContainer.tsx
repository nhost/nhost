import {
  createElement,
  forwardRef,
  type DetailedHTMLProps,
  type ElementType,
  type ForwardedRef,
  type HTMLProps,
  type PropsWithoutRef,
} from 'react';
import { twMerge } from 'tailwind-merge';

export interface AnnouncementContainerProps
  extends PropsWithoutRef<
    DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement>
  > {
  /**
   * Custom component to render as.
   */
  component?: ElementType<any>;
  /**
   * Props passed to component slots.
   */
  slotProps?: {
    /**
     * Props passed to the root component.
     */
    root?: DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement>;
    /**
     * Props passed to the content component.
     */
    content?: DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement>;
  };
}

function AnnouncementContainer(
  {
    component = 'div',
    className,
    children,
    slotProps,
    ...props
  }: AnnouncementContainerProps,
  ref: ForwardedRef<HTMLDivElement>,
) {
  return createElement(
    component,
    {
      ...props,
      ...(slotProps?.root || {}),
      ref,
      className: twMerge('w-full overflow-hidden', slotProps?.root?.className),
    },
    <div
      {...(slotProps?.content || {})}
      className={twMerge(
        'mx-auto max-w-7xl px-5',
        className,
        slotProps?.content?.className,
      )}
    >
      {children}
    </div>,
  );
}

export default forwardRef(AnnouncementContainer);

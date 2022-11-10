import type { NavLinkProps } from '@/components/common/NavLink';
import NavLink from '@/components/common/NavLink';
import type { ForwardedRef, ReactNode } from 'react';
import { cloneElement, forwardRef, isValidElement } from 'react';
import { twMerge } from 'tailwind-merge';

export interface IconLinkProps extends Omit<NavLinkProps, 'ref'> {
  /**
   * The icon to display.
   */
  icon?: ReactNode;
  /**
   * Determines if the content should be displayed in the primary color.
   */
  active?: boolean;
}

function IconLink(
  { className, children, icon, active, ...props }: IconLinkProps,
  ref: ForwardedRef<HTMLAnchorElement>,
) {
  if (props.disabled) {
    return (
      <span
        className={twMerge(
          'grid cursor-default grid-flow-row justify-items-center gap-1 rounded-md py-2.5 px-0.5 text-center text-[10px] font-medium opacity-40',
          className,
        )}
      >
        {isValidElement(icon)
          ? cloneElement(icon, {
              ...icon.props,
              className: twMerge('w-4 h-4', icon.props.className),
            })
          : null}

        {children}
      </span>
    );
  }

  return (
    <NavLink
      ref={ref}
      className={twMerge(
        'grid grid-flow-row justify-items-center gap-1 rounded-md py-2.5 px-0.5 text-center text-[10px] font-medium motion-safe:transition-colors',
        active ? 'bg-lightBlue bg-opacity-10 text-blue' : 'hover:bg-gray-100',
        className,
      )}
      {...props}
    >
      {isValidElement(icon)
        ? cloneElement(icon, {
            ...icon.props,
            className: twMerge('w-4 h-4', icon.props.className),
          })
        : null}

      {children}
    </NavLink>
  );
}

export default forwardRef(IconLink);

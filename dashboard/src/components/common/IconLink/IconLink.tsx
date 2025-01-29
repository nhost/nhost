import type { NavLinkProps } from '@/components/common/NavLink';
import { NavLink } from '@/components/common/NavLink';
import type { SvgIconProps } from '@/components/ui/v2/icons/SvgIcon';
import type { ForwardedRef, PropsWithoutRef, ReactElement } from 'react';
import { cloneElement, forwardRef, isValidElement } from 'react';
import { twMerge } from 'tailwind-merge';

export interface IconLinkProps extends PropsWithoutRef<NavLinkProps> {
  /**
   * The icon to display.
   */
  icon?: ReactElement<SvgIconProps>;
  /**
   * Determines if the content should be displayed in the primary color.
   */
  active?: boolean;
}

function IconLink(
  { className, children, icon, active, href, ...props }: IconLinkProps,
  ref: ForwardedRef<HTMLAnchorElement>,
) {
  if (props.disabled) {
    return (
      <span
        className={twMerge(
          'grid cursor-default grid-flow-row justify-items-center gap-1 rounded-md px-0.5 py-2.5 text-center text-[10px] font-medium opacity-40',
          className,
        )}
      >
        {isValidElement(icon)
          ? cloneElement(icon, {
              ...icon.props,
              className: twMerge('w-4 h-4', icon.props.className),
              sx: [
                ...(Array.isArray(icon.props?.sx)
                  ? icon.props.sx
                  : [icon.props?.sx]),
                {
                  color: (theme) => {
                    if (props.disabled) {
                      return theme.palette.mode === 'dark'
                        ? 'text.secondary'
                        : 'text.primary';
                    }

                    if (active) {
                      return 'primary.main';
                    }

                    return theme.palette.mode === 'dark'
                      ? 'text.secondary'
                      : 'text.primary';
                  },
                },
              ],
            })
          : null}

        {children}
      </span>
    );
  }

  return (
    <NavLink
      ref={ref}
      href={href}
      underline="none"
      className={twMerge(
        'grid grid-flow-row justify-items-center gap-1 rounded-md px-0.5 py-2.5 text-center font-medium motion-safe:transition-colors',
        className,
      )}
      sx={{
        fontSize: (theme) => theme.typography.pxToRem(10),
        lineHeight: (theme) => theme.typography.pxToRem(15),
        backgroundColor: active ? 'primary.light' : 'transparent',
        color: active ? 'primary.main' : 'text.primary',
        [`&:hover`]: {
          backgroundColor: active ? 'primary.light' : 'action.hover',
        },
      }}
      {...props}
    >
      {isValidElement(icon)
        ? cloneElement(icon, {
            ...icon.props,
            className: twMerge('w-4 h-4', icon.props.className),
            sx: [
              ...(Array.isArray(icon.props?.sx)
                ? icon.props.sx
                : [icon.props?.sx]),
              {
                color: (theme) => {
                  if (active) {
                    return 'primary.main';
                  }

                  return theme.palette.mode === 'dark'
                    ? 'text.secondary'
                    : 'text.primary';
                },
              },
            ],
          })
        : null}

      {children}
    </NavLink>
  );
}

export default forwardRef(IconLink);

import Loading from '@/ui/Loading';
import clsx from 'clsx';
import type { ButtonHTMLAttributes, JSXElementConstructor } from 'react';
import React, { forwardRef, useRef } from 'react';
import mergeRefs from 'react-merge-refs';
import s from './Button.module.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  href?: string;
  className?: string;
  variant?: 'primary' | 'dark' | 'secondary' | 'menu' | 'danger';
  color?: 'blue' | 'red';
  active?: boolean;
  type?: 'submit' | 'reset' | 'button';
  Component?: string | JSXElementConstructor<any>;
  width?: string | number;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  transparent?: boolean;
  target?: string;
  rel?: string;
  onClick?: any;
  border?: boolean;
  showLoadingText?: boolean;
  padding?: 'none' | Array<'horizontal' | 'vertical'>;
}

/**
 * @deprecated Use `@/ui/v2/Button` instead.
 */
export const Button: React.FC<ButtonProps> = forwardRef(
  (props: ButtonProps, buttonRef) => {
    const {
      className,
      variant,
      children,
      active,
      width,
      small,
      href,
      color,
      border,
      loading = false,
      disabled = false,
      transparent = false,
      style = {},
      type = 'button',
      Component = 'button',
      showLoadingText = false,
      padding = ['horizontal', 'vertical'],
      ...rest
    } = props;
    const ref = useRef<typeof Component>(null);
    const paddingSet = new Set(padding);

    const rootClassName = clsx(
      s.root,
      {
        [s.primary]: variant === 'primary',
        [s.secondary]: variant === 'secondary',
        [s.menu]: variant === 'menu',
        [s.dark]: variant === 'dark',
        [s.danger]: variant === 'danger',
        [s.loading]: loading,
        [s.disabled]: disabled,
        [s.small]: small,
        [s.transparent]: transparent,
        [s.blue]: color === 'blue',
        [s.red]: color === 'red',
        [s.border]: border,
        [s.paddingHorizontal]:
          padding === 'none' ? false : paddingSet.has('horizontal'),
        [s.paddingVertical]:
          padding === 'none' ? false : paddingSet.has('vertical'),
      },
      className,
    );

    return (
      <Component
        aria-pressed={active}
        data-variant={variant}
        ref={mergeRefs([ref, buttonRef])}
        className={rootClassName}
        disabled={disabled}
        type={type}
        href={href}
        style={{
          width,
          ...style,
        }}
        {...rest}
      >
        {loading ? null : children}

        {loading && showLoadingText && (
          <div className=" mx-auto flex w-full flex-row">
            Loading
            <Loading className="ml-3" />
          </div>
        )}

        {loading && !showLoadingText && (
          <div className=" mx-auto flex w-full flex-row">
            <Loading className="" />
          </div>
        )}
      </Component>
    );
  },
);
Button.displayName = 'Button';

export default Button;

import clsx from 'clsx';
import type {
  DetailedHTMLProps,
  ForwardedRef,
  HTMLProps,
  ReactNode,
} from 'react';
import { forwardRef } from 'react';

export interface InputFieldProps
  extends DetailedHTMLProps<HTMLProps<HTMLInputElement>, HTMLInputElement> {
  /**
   * Props to be passed to the input wrapper.
   */
  wrapperProps?: Omit<
    DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement>,
    'children'
  >;
  /**
   * Props to be passed to the label element.
   */
  labelProps?: Omit<
    DetailedHTMLProps<HTMLProps<HTMLLabelElement>, HTMLLabelElement>,
    'htmlFor' | 'children'
  >;
  /**
   * Input label.
   */
  label?: string;
  /**
   * Start input adornment for this component.
   */
  startAdornment?: ReactNode;
  /**
   * Error to be displayed.
   */
  error?: ReactNode;
}

const InlineInput = forwardRef(
  (
    {
      label,
      labelProps,
      startAdornment,
      wrapperProps,
      className,
      error,
      ...props
    }: InputFieldProps,
    ref: ForwardedRef<HTMLInputElement>,
  ) => {
    const { className: labelClassName, ...restLabelProps } = labelProps || {};
    const { className: wrapperClassName, ...restWrapperProps } =
      wrapperProps || {};

    return (
      <div className="grid grid-flow-row gap-1">
        <div
          className={clsx(
            'grid grid-cols-5 items-center gap-y-1 py-1.5',
            wrapperClassName,
          )}
          {...restWrapperProps}
        >
          {label && (
            <label
              htmlFor={props.id}
              className={clsx(
                'col-span-2 text-sm+ font-medium text-greyscaleDark',
                labelClassName,
              )}
              {...restLabelProps}
            >
              {label}
            </label>
          )}

          <div
            className={clsx(
              'flex flex-row place-content-start items-center rounded-sm px-2 py-1',
              error
                ? 'outline outline-2 outline-red'
                : 'focus-within:outline focus-within:outline-2 focus-within:outline-blue',
              label ? 'col-span-3' : 'col-span-5',
            )}
          >
            {startAdornment && (
              <label className="flex-shrink-0" htmlFor={props.id}>
                {startAdornment}
              </label>
            )}

            <input
              className={clsx(
                'h-full w-full rounded-sm+ px-0.5 font-display text-sm+ text-greyscaleDark focus:outline-none',
                className,
              )}
              aria-invalid={Boolean(error)}
              ref={ref}
              {...props}
            />
          </div>

          {error && (
            <div
              className="col-span-5 text-right text-xs text-red"
              role="alert"
            >
              {error}
            </div>
          )}
        </div>
      </div>
    );
  },
);

InlineInput.displayName = 'NhostInlineInput';

export default InlineInput;

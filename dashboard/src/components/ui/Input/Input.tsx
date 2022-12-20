import clsx from 'clsx';
import type { InputHTMLAttributes } from 'react';
import React, { forwardRef, useRef } from 'react';
import mergeRefs from 'react-merge-refs';
import s from './Input.module.css';

export interface InputProps
  extends InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
  className?: string;
  onChange?: (...args: any[]) => any;
  onEnter?: () => void;
  disabled?: boolean;
  allowEndAdornment?: boolean;
  monospacedFont?: boolean;
  error?: boolean;
  ref?: any;
  autoComplete?: string;
  multiline?: boolean;
}

/**
 * @deprecated Use `@/ui/v2/Input` instead.
 */
export const Input: React.FC<InputProps> = forwardRef(
  (
    {
      className,
      onChange,
      onEnter,
      disabled,
      allowEndAdornment,
      monospacedFont,
      error,
      placeholder,
      autoComplete,
      multiline,
      ...rest
    }: InputProps,
    inputRef,
  ) => {
    const rootClassName = clsx(
      s.root,
      {
        [s.disabled]: disabled,
        [s.allowEndAdornment]: allowEndAdornment,
        [s.monospacedFont]: monospacedFont,
        [s.error]: error,
      },
      className,
    );
    const ref = useRef(null);

    const handleOnKeyDown = (e) => {
      if (e.key === 'Enter') {
        if (onEnter) {
          onEnter();
        }
      }
    };

    const handleOnChange = (e: any) => {
      e.preventDefault();
      if (onChange) {
        onChange(e.target.value);
      }
      return null;
    };

    const inputProps: InputHTMLAttributes<
      HTMLInputElement | HTMLTextAreaElement
    > = {
      disabled,
      placeholder,
      autoComplete: autoComplete || 'off',
      autoFocus: false,
      'aria-autocomplete': 'none',
      onChange: handleOnChange,
      onKeyDown: handleOnKeyDown,
      autoCorrect: 'off',
      spellCheck: false,
      ref: mergeRefs([inputRef, ref]),
      className: rootClassName,
      ...rest,
    };

    if (multiline) {
      return <textarea rows={5} {...inputProps} />;
    }

    return <input {...inputProps} />;
  },
);

Input.displayName = 'Input';

export default Input;

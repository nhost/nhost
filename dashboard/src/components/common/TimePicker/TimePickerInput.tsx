import { Input } from '@/components/ui/v3/input';

import { cn } from '@/lib/utils';
import React from 'react';
import {
  type Period,
  type TimePickerType,
  copyDate,
  getArrowByType,
  getDateByType,
  setDateByType,
} from './time-picker-utils';

export interface TimePickerInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  picker: TimePickerType;
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  period?: Period;
  onRightFocus?: () => void;
  onLeftFocus?: () => void;
}

const TimePickerInput = React.forwardRef<
  HTMLInputElement,
  TimePickerInputProps
>(
  (
    {
      className,
      type = 'tel',
      value,
      id,
      name,
      date = new Date(new Date().setHours(0, 0, 0, 0)),
      setDate,
      onChange,
      onKeyDown,
      picker,
      period,
      onLeftFocus,
      onRightFocus,
      ...props
    },
    ref,
  ) => {
    const [flag, setFlag] = React.useState<boolean>(false);
    const [prevIntKey, setPrevIntKey] = React.useState<string>('0');

    /**
     * allow the user to enter the second digit within 2 seconds
     * otherwise start again with entering first digit
     */
    // eslint-disable-next-line consistent-return
    React.useEffect(() => {
      if (flag) {
        const timer = setTimeout(() => {
          setFlag(false);
        }, 2000);

        return () => clearTimeout(timer);
      }
    }, [flag]);

    const calculatedValue = React.useMemo(
      () => getDateByType(date, picker),
      [date, picker],
    );

    const calculateNewValue = (key: string) => {
      /*
       * If picker is '12hours' and the first digit is 0, then the second digit is automatically set to 1.
       * The second entered digit will break the condition and the value will be set to 10-12.
       */
      if (picker === '12hours') {
        if (flag && calculatedValue.slice(1, 2) === '1' && prevIntKey === '0') {
          return `0${key}`;
        }
      }

      return !flag ? `0${key}` : calculatedValue.slice(1, 2) + key;
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Tab') {
        return;
      }
      e.preventDefault();
      if (e.key === 'ArrowRight') {
        onRightFocus?.();
      }
      if (e.key === 'ArrowLeft') {
        onLeftFocus?.();
      }
      if (['ArrowUp', 'ArrowDown'].includes(e.key)) {
        const step = e.key === 'ArrowUp' ? 1 : -1;
        const newValue = getArrowByType(calculatedValue, step, picker);
        if (flag) {
          setFlag(false);
        }

        const tempDate = copyDate(date);
        setDate(setDateByType(tempDate, newValue, picker, period));
      }
      if (e.key >= '0' && e.key <= '9') {
        if (picker === '12hours') {
          setPrevIntKey(e.key);
        }

        const newValue = calculateNewValue(e.key);
        if (flag) {
          onRightFocus?.();
        }
        setFlag((prev) => !prev);
        const tempDate = copyDate(date);
        setDate(setDateByType(tempDate, newValue, picker, period));
      }
    };

    return (
      <Input
        ref={ref}
        id={id || picker}
        name={name || picker}
        className={cn(
          'w-[48px] text-center font-mono text-base tabular-nums caret-transparent focus:bg-accent focus:text-accent-foreground [&::-webkit-inner-spin-button]:appearance-none',
          className,
        )}
        value={value || calculatedValue}
        onChange={(e) => {
          e.preventDefault();
          onChange?.(e);
        }}
        type={type}
        inputMode="decimal"
        onKeyDown={(e) => {
          onKeyDown?.(e);
          handleKeyDown(e);
        }}
        {...props}
      />
    );
  },
);

TimePickerInput.displayName = 'TimePickerInput';

export { TimePickerInput };

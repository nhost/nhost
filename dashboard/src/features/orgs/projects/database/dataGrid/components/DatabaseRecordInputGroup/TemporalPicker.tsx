import { format, isValid, parseISO } from 'date-fns';
import type { ChangeEvent, FocusEvent, KeyboardEvent } from 'react';
import { DatePicker } from '@/components/common/DatePicker';
import { DateTimePicker } from '@/components/common/DateTimePicker';
import type { PickerTriggerSlot } from '@/components/common/PickerTriggerSlot';
import { TimePickerField } from '@/components/common/TimePickerField';
import { Input } from '@/components/ui/v3/input';
import {
  isDateType,
  isTimeType,
} from '@/features/orgs/projects/database/dataGrid/utils/temporalTypeHelpers';
import { cn } from '@/lib/utils';

interface TemporalPickerProps {
  id?: string;
  baseType?: string | null;
  value: string | null;
  onChange: (value: string | null) => void;
  emptyLabel?: string;
  error?: boolean;
}

function isTimestampWithTimezone(baseType?: string | null) {
  return baseType === 'timestamp with time zone';
}

function isTimeWithTimezone(baseType?: string | null) {
  return baseType === 'time with time zone';
}

function getPlaceholder(baseType?: string | null) {
  if (isDateType(baseType)) {
    return 'YYYY-MM-DD';
  }

  if (isTimeType(baseType)) {
    return isTimeWithTimezone(baseType) ? 'HH:MM:SS+00' : 'HH:MM:SS';
  }

  return isTimestampWithTimezone(baseType)
    ? 'YYYY-MM-DD HH:MM:SS+00'
    : 'YYYY-MM-DD HH:MM:SS';
}

function getPickerDateValue(value: string | null) {
  if (!value) {
    return null;
  }

  return isValid(parseISO(value)) ? value : null;
}

function formatDatePickerValue(iso: string | null) {
  return iso ? format(new Date(iso), 'yyyy-MM-dd') : null;
}

function formatDateTimePickerValue(
  iso: string | null,
  baseType?: string | null,
) {
  if (!iso) {
    return null;
  }

  if (isTimestampWithTimezone(baseType)) {
    return iso;
  }

  return format(new Date(iso), "yyyy-MM-dd'T'HH:mm:ss");
}

export default function TemporalPicker({
  id,
  baseType,
  value,
  onChange,
  emptyLabel,
  error,
}: TemporalPickerProps) {
  const rawValue = value ?? '';
  const placeholder = emptyLabel ?? getPlaceholder(baseType);

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(event.target.value === '' ? null : event.target.value);
  }

  const renderInputTrigger: PickerTriggerSlot = ({
    triggerProps,
    hasError,
  }) => {
    function handleFocus(event: FocusEvent<HTMLInputElement>) {
      triggerProps.onFocus?.(event);
    }

    function handleBlur(event: FocusEvent<HTMLInputElement>) {
      triggerProps.onBlur?.(event);
    }

    function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
      triggerProps.onKeyDown?.(event);
    }

    return (
      <Input
        id={id}
        value={rawValue}
        placeholder={placeholder}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        role={triggerProps.role}
        aria-expanded={triggerProps['aria-expanded']}
        aria-haspopup={triggerProps['aria-haspopup']}
        aria-invalid={triggerProps['aria-invalid']}
        className={cn({ 'border-destructive': hasError })}
      />
    );
  };

  if (isTimeType(baseType)) {
    return (
      <TimePickerField
        time={rawValue || null}
        onTimeChange={onChange}
        emptyLabel={placeholder}
        error={error}
        utc={isTimeWithTimezone(baseType)}
        triggerSlot={renderInputTrigger}
      />
    );
  }

  const pickerDateValue = getPickerDateValue(value);

  if (isDateType(baseType)) {
    return (
      <DatePicker
        date={pickerDateValue}
        onDateChange={(iso) => onChange(formatDatePickerValue(iso))}
        emptyLabel={placeholder}
        error={error}
        triggerSlot={renderInputTrigger}
      />
    );
  }

  return (
    <DateTimePicker
      dateTime={pickerDateValue}
      onDateTimeChange={(iso) =>
        onChange(formatDateTimePickerValue(iso, baseType))
      }
      emptyLabel={placeholder}
      error={error}
      withTimezone={isTimestampWithTimezone(baseType)}
      defaultTimezone="UTC"
      triggerSlot={renderInputTrigger}
    />
  );
}

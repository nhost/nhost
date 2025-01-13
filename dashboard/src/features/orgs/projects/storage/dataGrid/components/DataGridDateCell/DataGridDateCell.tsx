import { Input, inputClasses } from '@/components/ui/v2/Input';
import type { TextProps } from '@/components/ui/v2/Text';
import { Text } from '@/components/ui/v2/Text';
import type { CommonDataGridCellProps } from '@/features/orgs/projects/storage/dataGrid/components/DataGridCell';
import { useDataGridCell } from '@/features/orgs/projects/storage/dataGrid/components/DataGridCell';
import { getDateComponents } from '@/utils/getDateComponents';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { twMerge } from 'tailwind-merge';

export interface DataGridDateCellProps<TData extends object>
  extends CommonDataGridCellProps<TData, string> {
  /**
   * Props to be passed to date display.
   */
  dateProps?: TextProps;
  /**
   * Props to be passed to time display.
   */
  timeProps?: TextProps;
}

export default function DataGridDateCell<TData extends object>({
  onSave,
  optimisticValue,
  temporaryValue,
  onTemporaryValueChange,
  cell: {
    column: { specificType },
  },
  dateProps,
  timeProps,
  className,
}: DataGridDateCellProps<TData>) {
  const { className: dateClassName, ...restDateProps } = dateProps || {};
  const { className: timeClassName, ...restTimeProps } = timeProps || {};

  // Note: No date (year-month-day) is saved for time / timetz columns, so we
  // need to add it manually.
  const date =
    optimisticValue && specificType !== 'interval'
      ? new Date(
          specificType === 'time' || specificType === 'timetz'
            ? `1970-01-01 ${optimisticValue}`
            : optimisticValue,
        )
      : undefined;

  const { year, month, day, hour, minute, second } = getDateComponents(date, {
    adjustTimezone: ['date', 'timetz', 'timestamptz'].includes(specificType),
  });

  const { inputRef, focusCell, isEditing, cancelEditCell } =
    useDataGridCell<HTMLInputElement>();

  async function handleSave() {
    if (onSave) {
      await onSave(temporaryValue || '');
    }
  }

  async function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (
      event.key === 'ArrowLeft' ||
      event.key === 'ArrowRight' ||
      event.key === 'ArrowUp' ||
      event.key === 'ArrowDown' ||
      event.key === 'Backspace'
    ) {
      event.stopPropagation();
    }

    if (event.key === 'Tab') {
      await handleSave();
    }

    if (event.key === 'Enter') {
      await handleSave();
      await focusCell();
      cancelEditCell();
    }
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target instanceof HTMLInputElement && onTemporaryValueChange) {
      onTemporaryValueChange(event.target.value);
    }
  }

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        value={
          temporaryValue !== null && typeof temporaryValue !== 'undefined'
            ? temporaryValue
            : ''
        }
        onKeyDown={handleKeyDown}
        onChange={handleChange}
        fullWidth
        className="absolute top-0 z-10 -mx-0.5 h-full place-content-stretch"
        sx={{
          [`&.${inputClasses.focused}`]: {
            boxShadow: `inset 0 0 0 1.5px rgba(0, 82, 205, 1)`,
            borderColor: 'transparent !important',
            borderRadius: 0,
            backgroundColor: (theme) =>
              theme.palette.mode === 'dark'
                ? `${theme.palette.secondary[100]} !important`
                : `${theme.palette.common.white} !important`,
          },
          [`& .${inputClasses.input}`]: {
            backgroundColor: 'transparent',
          },
        }}
        slotProps={{
          inputWrapper: { className: 'h-full' },
          input: { className: 'h-full' },
          inputRoot: {
            className:
              'resize-none outline-none focus:outline-none !text-xs focus:ring-0',
          },
        }}
      />
    );
  }

  if (!optimisticValue) {
    return (
      <Text className="truncate text-xs" color="secondary">
        null
      </Text>
    );
  }

  if (specificType === 'interval') {
    return <Text className="truncate text-xs">{optimisticValue}</Text>;
  }

  return (
    <div className={twMerge('grid grid-flow-row', className)}>
      {specificType !== 'time' && specificType !== 'timetz' && (
        <Text
          className={twMerge('truncate text-xs', dateClassName)}
          {...restDateProps}
        >
          {[year, month, day].filter(Boolean).join('-')}
        </Text>
      )}

      {specificType !== 'date' && (
        <Text
          className={twMerge('truncate text-xs', timeClassName)}
          color={
            specificType === 'time' || specificType === 'timetz'
              ? 'primary'
              : 'secondary'
          }
          {...restTimeProps}
        >
          {[hour, minute, second].filter(Boolean).join(':')}
        </Text>
      )}
    </div>
  );
}

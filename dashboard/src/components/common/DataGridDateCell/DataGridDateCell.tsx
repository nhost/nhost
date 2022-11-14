import type { CommonDataGridCellProps } from '@/components/common/DataGridCell';
import { useDataGridCell } from '@/components/common/DataGridCell';
import { getDateComponents } from '@/utils/formatDate';
import type {
  ChangeEvent,
  DetailedHTMLProps,
  HTMLProps,
  KeyboardEvent,
} from 'react';
import { twMerge } from 'tailwind-merge';

export interface DataGridDateCellProps<TData extends object>
  extends CommonDataGridCellProps<TData, string> {
  /**
   * Props to be passed to date display.
   */
  dateProps?: DetailedHTMLProps<HTMLProps<HTMLSpanElement>, HTMLSpanElement>;
  /**
   * Props to be passed to time display.
   */
  timeProps?: DetailedHTMLProps<HTMLProps<HTMLSpanElement>, HTMLSpanElement>;
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
    adjustTimezone: specificType === 'timetz' || specificType === 'timestamptz',
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
      <input
        defaultValue={optimisticValue || ''}
        ref={inputRef}
        onKeyDown={handleKeyDown}
        onChange={handleChange}
        className="h-full w-full border-none px-1.5 text-xs text-greyscaleDark focus:outline-none focus:ring-0"
      />
    );
  }

  if (!optimisticValue) {
    return <span className="truncate text-greyscaleGrey">null</span>;
  }

  if (specificType === 'interval') {
    return (
      <span className="truncate text-greyscaleDark">{optimisticValue}</span>
    );
  }

  return (
    <div className={twMerge('grid grid-flow-row', className)}>
      {specificType !== 'time' && specificType !== 'timetz' && (
        <span
          className={twMerge('truncate text-greyscaleDark', dateClassName)}
          {...restDateProps}
        >
          {[year, month, day].filter(Boolean).join('-')}
        </span>
      )}

      {specificType !== 'date' && (
        <span
          className={twMerge(
            'truncate',
            specificType === 'time' || specificType === 'timetz'
              ? 'text-greyscaleDark'
              : 'text-greyscaleGrey',
            timeClassName,
          )}
          {...restTimeProps}
        >
          {[hour, minute, second].filter(Boolean).join(':')}
        </span>
      )}
    </div>
  );
}

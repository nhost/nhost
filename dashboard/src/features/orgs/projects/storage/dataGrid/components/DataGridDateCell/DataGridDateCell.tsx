import { Input } from '@/components/ui/v3/input';
import type { CommonDataGridCellProps } from '@/features/orgs/projects/storage/dataGrid/components/DataGridCell';
import { useDataGridCell } from '@/features/orgs/projects/storage/dataGrid/components/DataGridCell';
import { cn } from '@/lib/utils';
import { getDateComponents } from '@/utils/getDateComponents';
import type { ChangeEvent, KeyboardEvent, Ref } from 'react';

export interface DataGridDateCellProps<TData extends object>
  extends CommonDataGridCellProps<TData, string> {}

export default function DataGridDateCell<TData extends object>({
  onSave,
  optimisticValue,
  temporaryValue,
  onTemporaryValueChange,
  cell: {
    column: { specificType },
  },
  className,
}: DataGridDateCellProps<TData>) {
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
    adjustTimezone: ['date', 'timetz', 'timestamptz'].includes(
      specificType as string,
    ),
  });

  const { inputRef, isEditing } = useDataGridCell<HTMLInputElement>();

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
        ref={inputRef as Ref<HTMLInputElement>}
        value={
          temporaryValue !== null && typeof temporaryValue !== 'undefined'
            ? temporaryValue
            : ''
        }
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        wrapperClassName="absolute top-0 z-10 w-full top-0 left-0 h-full"
        className="!text-xs h-full w-full resize-none rounded-none border-none px-2 py-1.5 outline-none focus-within:rounded-none focus-within:border-transparent focus-within:bg-white focus-within:shadow-[inset_0_0_0_1.5px_rgba(0,82,205,1)] focus:outline-none focus:ring-0 dark:focus-within:bg-theme-grey-200"
      />
    );
  }

  if (!optimisticValue) {
    return <p className="truncate text-secondary text-xs">null</p>;
  }

  if (specificType === 'interval') {
    return <p className="truncate text-xs">{optimisticValue}</p>;
  }

  return (
    <div className={cn('grid grid-flow-row', className)}>
      <p className="truncate text-xs">
        {specificType !== 'time' && specificType !== 'timetz' && (
          <span>{[year, month, day].filter(Boolean).join('-')}</span>
        )}{' '}
        {specificType !== 'date' && (
          <span>{[hour, minute, second].filter(Boolean).join(':')}</span>
        )}
      </p>
    </div>
  );
}

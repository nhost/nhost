import type { CommonDataGridCellProps } from '@/components/common/DataGridCell';
import { useDataGridCell } from '@/components/common/DataGridCell';
import type { ChangeEvent, KeyboardEvent } from 'react';

export type DataGridNumericCellProps<TData extends object> =
  CommonDataGridCellProps<TData, number>;

export default function DataGridNumericCell<TData extends object>({
  onSave,
  optimisticValue,
  temporaryValue,
  onTemporaryValueChange,
}: DataGridNumericCellProps<TData>) {
  const { inputRef, focusCell, isEditing, cancelEditCell } =
    useDataGridCell<HTMLInputElement>();

  async function handleSave() {
    if (onSave) {
      if (typeof temporaryValue === 'number') {
        await onSave(temporaryValue);
      } else {
        await onSave(null);
      }
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
    if (onTemporaryValueChange) {
      if (event.target.value) {
        onTemporaryValueChange(parseInt(event.target.value, 10));
      } else {
        onTemporaryValueChange(null);
      }
    }
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="number"
        value={
          temporaryValue !== null && typeof temporaryValue !== 'undefined'
            ? temporaryValue
            : ''
        }
        onKeyDown={handleKeyDown}
        onChange={handleChange}
        className="h-full w-full border-none px-1.5 text-xs text-greyscaleDark focus:outline-none focus:ring-0"
      />
    );
  }

  if (optimisticValue === null || typeof optimisticValue === 'undefined') {
    return <span className="truncate text-greyscaleGrey">null</span>;
  }

  return <span className="truncate text-greyscaleDark">{optimisticValue}</span>;
}

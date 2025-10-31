import { Input } from '@/components/ui/v3/input';
import type { CommonDataGridCellProps } from '@/features/orgs/projects/storage/dataGrid/components/DataGridCell';
import { useDataGridCell } from '@/features/orgs/projects/storage/dataGrid/components/DataGridCell';
import { isNotEmptyValue } from '@/lib/utils';
import {
  useEffect,
  type ChangeEvent,
  type KeyboardEvent,
  type Ref,
} from 'react';

export type DataGridNumericCellProps<TData extends object> =
  CommonDataGridCellProps<TData, number | null>;

export default function DataGridNumericCell<TData extends object>({
  onSave,
  optimisticValue,
  temporaryValue,
  onTemporaryValueChange,
  cell: {
    column: { dataType },
  },
}: DataGridNumericCellProps<TData>) {
  const { inputRef, isEditing } = useDataGridCell<HTMLInputElement>();

  useEffect(() => {
    const controller = new AbortController();
    function preventWheelInNumberInput(event: WheelEvent) {
      event.preventDefault();
    }
    if (inputRef.current) {
      inputRef.current.addEventListener('wheel', preventWheelInNumberInput, {
        passive: false,
        signal: controller.signal,
      });
    }
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputRef.current]);

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
    if (isNotEmptyValue(onSave) && typeof temporaryValue !== 'undefined') {
      if (event.key === 'Tab') {
        await onSave?.(temporaryValue);
      }

      if (event.key === 'Enter') {
        await onSave?.(temporaryValue);
      }
    }
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    if (onTemporaryValueChange) {
      const newValue = isNotEmptyValue(event.target.value)
        ? +event.target.value
        : null;
      onTemporaryValueChange(newValue);
    }
  }

  if (isEditing) {
    const step = dataType === 'integer' ? 1 : 0.1;

    return (
      <Input
        type="number"
        ref={inputRef as Ref<HTMLInputElement>}
        value={
          temporaryValue !== null && typeof temporaryValue !== 'undefined'
            ? temporaryValue
            : ''
        }
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        wrapperClassName="absolute top-0 z-10 w-full top-0 left-0 h-full"
        className="h-full w-full resize-none rounded-none border-none px-2 py-1.5 !text-xs outline-none [appearance:textfield] focus-within:rounded-none focus-within:border-transparent focus-within:bg-white focus-within:shadow-[inset_0_0_0_1.5px_rgba(0,82,205,1)] focus:outline-none focus:ring-0 dark:focus-within:bg-theme-grey-200 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        step={step}
      />
    );
  }

  if (optimisticValue === null || typeof optimisticValue === 'undefined') {
    return <p className="truncate !text-xs text-disabled">null</p>;
  }

  return <p className="truncate !text-xs">{optimisticValue}</p>;
}

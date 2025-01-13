import { Input, inputClasses } from '@/components/ui/v2/Input';
import { Text } from '@/components/ui/v2/Text';
import type { CommonDataGridCellProps } from '@/features/orgs/projects/storage/dataGrid/components/DataGridCell';
import { useDataGridCell } from '@/features/orgs/projects/storage/dataGrid/components/DataGridCell';
import type { ChangeEvent, KeyboardEvent } from 'react';

export type DataGridDecimalCellProps<TData extends object> =
  CommonDataGridCellProps<TData, number | string>;

export default function DataGridDecimalCell<TData extends object>({
  onSave,
  optimisticValue,
  temporaryValue,
  onTemporaryValueChange,
}: DataGridDecimalCellProps<TData>) {
  const { inputRef, focusCell, isEditing, cancelEditCell } =
    useDataGridCell<HTMLInputElement>();

  async function handleSave() {
    if (onSave) {
      if (typeof temporaryValue === 'string') {
        await onSave(parseFloat(temporaryValue));
      } else if (typeof temporaryValue === 'number') {
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
      onTemporaryValueChange(event.target.value ?? null);
    }
  }

  if (isEditing) {
    return (
      <Input
        type="text"
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

  if (optimisticValue === null || typeof optimisticValue === 'undefined') {
    return (
      <Text className="truncate !text-xs" color="disabled">
        null
      </Text>
    );
  }

  return <Text className="truncate !text-xs">{optimisticValue}</Text>;
}

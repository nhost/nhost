import type { CommonDataGridCellProps } from '@/components/dataGrid/DataGridCell';
import { useDataGridCell } from '@/components/dataGrid/DataGridCell';
import { ReadOnlyToggle } from '@/components/presentational/ReadOnlyToggle';
import { Dropdown } from '@/components/ui/v2/Dropdown';
import type { MouseEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { twMerge } from 'tailwind-merge';

export type DataGridBooleanCellProps<TData extends object> =
  CommonDataGridCellProps<TData, boolean | null>;

export default function DataGridBooleanCell<TData extends object>({
  onSave,
  optimisticValue,
  temporaryValue,
  onTemporaryValueChange,
  cell: {
    column: { isNullable },
  },
}: DataGridBooleanCellProps<TData>) {
  const {
    inputRef,
    isEditing,
    focusCell,
    editCell,
    cancelEditCell,
    isSelected,
  } = useDataGridCell<HTMLInputElement>();

  async function handleMenuClick(
    event: MouseEvent<HTMLLIElement> | ReactKeyboardEvent<HTMLLIElement>,
    value: boolean | null,
  ) {
    event.stopPropagation();
    await onSave(value);
    cancelEditCell();
  }

  async function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (
      event.key === 'ArrowLeft' ||
      event.key === 'ArrowRight' ||
      event.key === 'ArrowUp' ||
      event.key === 'ArrowDown'
    ) {
      event.stopPropagation();
    }

    // We need to restore the temporary value, because editing was cancelled
    if (event.key === 'Escape' && onTemporaryValueChange) {
      event.stopPropagation();

      onTemporaryValueChange(optimisticValue);
      cancelEditCell();
    }

    if (event.key === 'Tab' && onSave) {
      await onSave(temporaryValue);
      cancelEditCell();
    }
  }

  function handleTemporaryValueChange(value: boolean | null) {
    if (onTemporaryValueChange) {
      onTemporaryValueChange(value);
    }
  }

  return isSelected ? (
    <Dropdown.Root id="boolean-data-editor" className="h-full w-full">
      <Dropdown.Trigger
        id="boolean-trigger"
        className={twMerge(
          'h-full w-full border-none p-0 outline-none',
          isEditing && 'p-1.5',
        )}
        ref={inputRef}
        onClick={editCell}
        autoFocus={false}
        sx={{ '&:hover': { backgroundColor: 'transparent !important' } }}
      >
        <ReadOnlyToggle checked={optimisticValue} />
      </Dropdown.Trigger>

      <Dropdown.Content
        menu
        disablePortal
        onKeyDown={handleMenuKeyDown}
        PaperProps={{ className: 'w-[200px]' }}
        TransitionProps={{ onExited: focusCell }}
      >
        <Dropdown.Item
          selected={optimisticValue === true}
          onKeyUp={() => handleTemporaryValueChange(true)}
          onClick={(event) => handleMenuClick(event, true)}
        >
          <ReadOnlyToggle checked />
        </Dropdown.Item>

        <Dropdown.Item
          selected={optimisticValue === false}
          onKeyUp={() => handleTemporaryValueChange(false)}
          onClick={(event) => handleMenuClick(event, false)}
        >
          <ReadOnlyToggle checked={false} />
        </Dropdown.Item>

        {isNullable && (
          <Dropdown.Item
            selected={optimisticValue === null}
            onKeyUp={() => handleTemporaryValueChange(null)}
            onClick={(event) => handleMenuClick(event, null)}
          >
            <ReadOnlyToggle checked={null} />
          </Dropdown.Item>
        )}
      </Dropdown.Content>
    </Dropdown.Root>
  ) : (
    <ReadOnlyToggle checked={optimisticValue} />
  );
}

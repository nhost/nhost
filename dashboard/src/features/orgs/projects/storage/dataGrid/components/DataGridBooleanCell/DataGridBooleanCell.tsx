import { ReadOnlyToggle } from '@/components/presentational/ReadOnlyToggle';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';
import type { CommonDataGridCellProps } from '@/features/orgs/projects/storage/dataGrid/components/DataGridCell';
import { useDataGridCell } from '@/features/orgs/projects/storage/dataGrid/components/DataGridCell';
import {
  useState,
  type MouseEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';

export type DataGridBooleanCellProps<TData extends object> =
  CommonDataGridCellProps<TData, boolean | null | undefined>;

export default function DataGridBooleanCell<TData extends object>({
  onSave,
  optimisticValue,
  temporaryValue,
  onTemporaryValueChange,
  cell: {
    column: { isNullable, getHeaderProps },
  },
}: DataGridBooleanCellProps<TData>) {
  const { inputRef, focusCell, cancelEditCell, focusNextCell, editCell } =
    useDataGridCell<HTMLButtonElement>();
  const [open, setOpen] = useState(false);

  async function handleMenuClick(
    event: MouseEvent<HTMLDivElement> | ReactKeyboardEvent<HTMLDivElement>,
    value: boolean | null,
  ) {
    event.stopPropagation();
    await onSave?.(value);
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
      focusCell();
    }

    if (event.key === 'Tab' && onSave) {
      await onSave(temporaryValue);
      setOpen(false);
      focusNextCell();
    }
  }

  function handleTemporaryValueChange(value: boolean | null) {
    if (onTemporaryValueChange) {
      onTemporaryValueChange(value);
    }
  }
  // needed to open with enter
  function handleTriggerClick() {
    if (!open) {
      setOpen(true);
    }
  }

  function handleOpenChange(newOpenState: boolean) {
    if (newOpenState) {
      editCell();
    } else {
      cancelEditCell();
    }
    setOpen(newOpenState);
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange} modal={false}>
      <DropdownMenuTrigger
        ref={inputRef}
        className="h-full w-full focus-visible:border-transparent focus-visible:outline-none"
        onClick={handleTriggerClick}
      >
        <ReadOnlyToggle checked={optimisticValue} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        style={{ width: getHeaderProps().style?.width }}
        onKeyDown={handleMenuKeyDown}
        className="rounded-t-none"
      >
        <DropdownMenuCheckboxItem
          checked={optimisticValue === true}
          onKeyUp={() => handleTemporaryValueChange(true)}
          onClick={(event) => handleMenuClick(event, true)}
        >
          <ReadOnlyToggle checked />
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={optimisticValue === false}
          onKeyUp={() => handleTemporaryValueChange(false)}
          onClick={(event) => handleMenuClick(event, false)}
        >
          <ReadOnlyToggle checked={false} />
        </DropdownMenuCheckboxItem>
        {isNullable && (
          <DropdownMenuCheckboxItem
            checked={optimisticValue === null}
            onKeyUp={() => handleTemporaryValueChange(null)}
            onClick={(event) => handleMenuClick(event, null)}
          >
            <ReadOnlyToggle checked={null} />
          </DropdownMenuCheckboxItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

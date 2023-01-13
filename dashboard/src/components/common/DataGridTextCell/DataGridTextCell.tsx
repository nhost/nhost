import type { CommonDataGridCellProps } from '@/components/common/DataGridCell';
import { useDataGridCell } from '@/components/common/DataGridCell';
import Button from '@/ui/v2/Button';
import CopyIcon from '@/ui/v2/icons/CopyIcon';
import Text from '@/ui/v2/Text';
import { copy } from '@/utils/copy';
import type { ChangeEvent, KeyboardEvent, MutableRefObject } from 'react';
import { useEffect } from 'react';
import { twMerge } from 'tailwind-merge';

export type DataGridTextCellProps<TData extends object> =
  CommonDataGridCellProps<TData, string>;

export default function DataGridTextCell<TData extends object>({
  onSave,
  optimisticValue,
  temporaryValue,
  onTemporaryValueChange,
  cell: {
    column: { isCopiable, specificType },
  },
}: DataGridTextCellProps<TData>) {
  const isMultiline =
    specificType === 'text' ||
    specificType === 'bpchar' ||
    specificType === 'varchar' ||
    specificType === 'json' ||
    specificType === 'jsonb';

  const normalizedOptimisticValue =
    optimisticValue !== null && typeof optimisticValue === 'object'
      ? optimisticValue
      : (String(optimisticValue) || '').replace(/(\\n)+/gi, ' ');

  const normalizedTemporaryValue =
    temporaryValue !== null && typeof temporaryValue === 'object'
      ? JSON.stringify(temporaryValue)
      : temporaryValue;

  const { inputRef, focusCell, isEditing, cancelEditCell } = useDataGridCell<
    HTMLInputElement | HTMLTextAreaElement
  >();

  useEffect(() => {
    if (isEditing && isMultiline) {
      const textArea = inputRef.current as HTMLTextAreaElement;

      textArea.setSelectionRange(textArea.value.length, textArea.value.length);
    }
  }, [inputRef, isEditing, isMultiline]);

  async function handleSave() {
    if (onSave) {
      await onSave((normalizedTemporaryValue || '').replace(/\n/gi, `\\n`));
    }
  }

  async function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
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

  async function handleTextAreaKeyDown(
    event: KeyboardEvent<HTMLTextAreaElement>,
  ) {
    if (
      event.key === 'ArrowLeft' ||
      event.key === 'ArrowRight' ||
      event.key === 'ArrowUp' ||
      event.key === 'ArrowDown' ||
      event.key === 'Backspace'
    ) {
      event.stopPropagation();
    }

    // Saving content Enter / CTRL + Enter / CMD + Enter (macOS) - but not on
    // Shift + Enter
    if (
      (!event.shiftKey && event.key === 'Enter') ||
      (event.ctrlKey && event.key === 'Enter') ||
      (event.metaKey && event.key === 'Enter')
    ) {
      event.preventDefault();
      event.stopPropagation();

      await handleSave();
      await focusCell();
      cancelEditCell();
    }

    if (event.key === 'Tab') {
      await handleSave();
    }
  }

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    if (onTemporaryValueChange) {
      onTemporaryValueChange(event.target.value);
    }
  }

  if (isEditing && isMultiline) {
    return (
      <textarea
        ref={inputRef as MutableRefObject<HTMLTextAreaElement>}
        value={(normalizedTemporaryValue || '').replace(/\\n/gi, `\n`)}
        onChange={handleChange}
        onKeyDown={handleTextAreaKeyDown}
        className={twMerge(
          'absolute top-0 z-10 -mx-0.5 h-full min-h-38 w-full resize-none border-none px-2 pt-4 text-xs text-greyscaleDark shadow-outline focus:outline-none focus:ring-0',
          isEditing && 'focus:shadow-outline-dark',
        )}
        rows={5}
      />
    );
  }

  if (isEditing) {
    return (
      <input
        value={normalizedTemporaryValue || ''}
        onKeyDown={handleInputKeyDown}
        onChange={handleChange}
        ref={inputRef as MutableRefObject<HTMLInputElement>}
        className="h-full w-full border-none px-2 text-xs text-greyscaleDark focus:outline-none focus:ring-0"
      />
    );
  }

  if (!optimisticValue) {
    return (
      <span className="truncate text-greyscaleGrey">
        {optimisticValue === '' ? 'empty' : 'null'}
      </span>
    );
  }

  if (isCopiable) {
    return (
      <div className="grid grid-flow-col items-center justify-start gap-1">
        <Button
          variant="borderless"
          color="secondary"
          onClick={(event) => {
            event.stopPropagation();

            const copiableValue =
              typeof optimisticValue === 'object'
                ? JSON.stringify(optimisticValue)
                : String(optimisticValue).replace(/\\n/gi, '\n');

            copy(copiableValue, 'Value');
          }}
          className="-ml-px min-w-0 p-0"
          aria-label="Copy value"
          sx={{ color: 'text.secondary' }}
        >
          <CopyIcon className="h-4 w-4" />
        </Button>

        <Text className="truncate text-xs">
          {typeof normalizedOptimisticValue === 'object'
            ? JSON.stringify(normalizedOptimisticValue)
            : normalizedOptimisticValue}
        </Text>
      </div>
    );
  }

  return (
    <Text className="truncate text-xs">
      {typeof normalizedOptimisticValue === 'object'
        ? JSON.stringify(normalizedOptimisticValue)
        : normalizedOptimisticValue}
    </Text>
  );
}

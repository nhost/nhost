import { Input } from '@/components/ui/v3/input';
import { Textarea } from '@/components/ui/v3/textarea';
import {
  useDataGridCell,
  type CommonDataGridCellProps,
} from '@/features/orgs/projects/storage/dataGrid/components/DataGridCell';

import type { ChangeEvent, KeyboardEvent, Ref } from 'react';
import { useEffect } from 'react';

export type DataGridTextCellProps<TData extends object> =
  CommonDataGridCellProps<TData, string>;

export default function DataGridTextCell<TData extends object>({
  onSave,
  optimisticValue,
  temporaryValue,
  onTemporaryValueChange,
  cell: {
    column: { specificType },
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
      <Textarea
        ref={inputRef as Ref<HTMLTextAreaElement>}
        value={(normalizedTemporaryValue || '').replace(/\\n/gi, `\n`)}
        onChange={handleChange}
        onKeyDown={handleTextAreaKeyDown}
        className="absolute left-0 top-0 z-10 h-25 min-h-25 w-full resize-none rounded-none !text-xs outline-none focus-within:rounded-none focus-within:border-transparent focus-within:bg-white focus-within:shadow-[inset_0_0_0_1.5px_rgba(0,82,205,1)] focus:outline-none focus:ring-0 dark:focus-within:bg-theme-grey-200"
      />
    );
  }

  if (isEditing) {
    return (
      <Input
        ref={inputRef as Ref<HTMLInputElement>}
        value={(normalizedTemporaryValue || '').replace(/\\n/gi, `\n`)}
        onChange={handleChange}
        onKeyDown={handleInputKeyDown}
        wrapperClassName="absolute top-0 z-10 w-full top-0 left-0 h-full"
        className="h-full w-full resize-none rounded-none border-none px-2 py-1.5 !text-xs outline-none focus-within:rounded-none focus-within:border-transparent focus-within:bg-white focus-within:shadow-[inset_0_0_0_1.5px_rgba(0,82,205,1)] focus:outline-none focus:ring-0 dark:focus-within:bg-theme-grey-200"
      />
    );
  }

  if (!optimisticValue) {
    return (
      <p className="truncate !text-xs text-[#7d8ca3]">
        {optimisticValue === '' ? 'empty' : 'null'}
      </p>
    );
  }

  return (
    <p className="truncate text-xs">
      {typeof normalizedOptimisticValue === 'object'
        ? JSON.stringify(normalizedOptimisticValue)
        : normalizedOptimisticValue}
    </p>
  );
}

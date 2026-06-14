import type { ChangeEvent, KeyboardEvent, Ref } from 'react';
import { useEffect } from 'react';
import { Input } from '@/components/ui/v3/input';
import { Textarea } from '@/components/ui/v3/textarea';
import { CellResetButtons } from '@/features/orgs/projects/storage/dataGrid/components/CellResetButtons';
import type { UnknownDataGridRow } from '@/features/orgs/projects/storage/dataGrid/components/DataGrid';
import {
  type CommonDataGridCellProps,
  useDataGridCell,
} from '@/features/orgs/projects/storage/dataGrid/components/DataGridCell';

export type DataGridTextCellProps<
  TData extends UnknownDataGridRow = UnknownDataGridRow,
> = CommonDataGridCellProps<TData, string | null>;

function parseHexEWKBPoint(hex: string) {
  if (typeof hex !== 'string') {
    return null;
  }
  const cleanHex = hex.trim().toLowerCase();
  if (cleanHex.length !== 50) {
    return null;
  }

  const byteOrder = cleanHex.substring(0, 2);
  const isLittleEndian = byteOrder === '01';

  const type = cleanHex.substring(2, 10);
  const isPointSRID = isLittleEndian
    ? type === '01000020'
    : type === '20000001';
  if (!isPointSRID) {
    return null;
  }

  const sridHex = cleanHex.substring(10, 18);
  const xHex = cleanHex.substring(18, 34);
  const yHex = cleanHex.substring(34, 50);

  function hexToDouble(hexStr: string, littleEndian: boolean) {
    const bytes = new Uint8Array(8);
    for (let i = 0; i < 8; i += 1) {
      const byteIndex = littleEndian ? i : 7 - i;
      bytes[byteIndex] = parseInt(hexStr.substring(i * 2, i * 2 + 2), 16);
    }
    const view = new DataView(bytes.buffer);
    return view.getFloat64(0, true);
  }

  function hexToInt(hexStr: string, littleEndian: boolean) {
    const bytes = new Uint8Array(4);
    for (let i = 0; i < 4; i += 1) {
      const byteIndex = littleEndian ? i : 3 - i;
      bytes[byteIndex] = parseInt(hexStr.substring(i * 2, i * 2 + 2), 16);
    }
    const view = new DataView(bytes.buffer);
    return view.getInt32(0, true);
  }

  try {
    const srid = hexToInt(sridHex, isLittleEndian);
    const x = hexToDouble(xHex, isLittleEndian);
    const y = hexToDouble(yHex, isLittleEndian);

    return {
      type: 'Point',
      crs: {
        type: 'name',
        properties: {
          name: `urn:ogc:def:crs:EPSG::${srid}`,
        },
      },
      coordinates: [x, y],
    };
  } catch {
    return null;
  }
}

export default function DataGridTextCell<
  TData extends UnknownDataGridRow = UnknownDataGridRow,
>({
  onSave,
  optimisticValue,
  temporaryValue,
  onTemporaryValueChange,
  cell: { column },
}: DataGridTextCellProps<TData>) {
  const baseType = column.columnDef.meta?.baseType;
  const isArray = column.columnDef.meta?.isArray;
  const isNullable = column.columnDef.meta?.isNullable;
  const hasDefault = column.columnDef.meta?.defaultValue != null;

  const specType = String(specificType || '').toLowerCase();
  const isGeo = specType.startsWith('geography') || specType.startsWith('geometry');

  const isMultiline =
    isArray ||
    baseType === 'text' ||
    baseType === 'bpchar' ||
    baseType === 'character' ||
    baseType === 'character varying' ||
    baseType === 'json' ||
    baseType === 'jsonb' ||
    isGeo;

  // Read-only display formatting
  const parsedOptimistic = isGeo && typeof optimisticValue === 'string'
    ? parseHexEWKBPoint(optimisticValue)
    : null;

  const displayOptimisticValue = parsedOptimistic
    ? JSON.stringify(parsedOptimistic)
    : (optimisticValue !== null && typeof optimisticValue === 'object'
      ? JSON.stringify(optimisticValue)
      : (String(optimisticValue) || '').replace(/(\\n)+/gi, ' '));

  // Edit-mode formatting
  let displayTemporaryValue = temporaryValue;
  if (isGeo && typeof temporaryValue === 'string') {
    const parsed = parseHexEWKBPoint(temporaryValue);
    if (parsed) {
      displayTemporaryValue = JSON.stringify(parsed, null, 2);
    }
  } else if (temporaryValue !== null && typeof temporaryValue === 'object') {
    displayTemporaryValue = JSON.stringify(temporaryValue, null, 2);
  }

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
      let valueToSave = displayTemporaryValue;
      if (isGeo && typeof displayTemporaryValue === 'string') {
        try {
          const parsed = JSON.parse(displayTemporaryValue);
          if (parsed && typeof parsed === 'object') {
            const x = parsed.coordinates[0];
            const y = parsed.coordinates[1];
            const srid = parsed.crs?.properties?.name?.split('::')[1] || '4326';
            valueToSave = `SRID=${srid};POINT(${x} ${y})`;
          }
        } catch {
          // Keep as is
        }
      }
      await onSave((valueToSave || '').replace(/\n/gi, `\\n`));
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

    if (event.key === 'Tab' && !event.shiftKey && (isNullable || hasDefault)) {
      event.stopPropagation();
      return;
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

    if (event.key === 'Tab' && !event.shiftKey && (isNullable || hasDefault)) {
      event.stopPropagation();
      return;
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
      <div className="absolute top-0 left-0 z-10 h-25 min-h-25 w-full">
        <Textarea
          ref={inputRef as Ref<HTMLTextAreaElement>}
          value={(displayTemporaryValue || '').replace(/\\n/gi, `\n`)}
          onChange={handleChange}
          onKeyDown={handleTextAreaKeyDown}
          className="!text-xs h-full w-full resize-none rounded-none outline-none focus-within:rounded-none focus-within:border-transparent focus-within:bg-white focus-within:shadow-[inset_0_0_0_1.5px_rgba(0,82,205,1)] focus:outline-none focus:ring-0 dark:focus-within:bg-theme-grey-200"
        />
        {(isNullable || hasDefault) && (
          <CellResetButtons
            isNullable={isNullable}
            hasDefault={hasDefault}
            onSetNull={() => onSave?.(null, { reset: 'null' })}
            onSetDefault={() => onSave?.(null, { reset: 'default' })}
            className="absolute right-1 bottom-1"
          />
        )}
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="absolute top-0 left-0 z-10 h-full w-full">
        <Input
          ref={inputRef as Ref<HTMLInputElement>}
          value={(displayTemporaryValue || '').replace(/\\n/gi, `\n`)}
          onChange={handleChange}
          onKeyDown={handleInputKeyDown}
          wrapperClassName="h-full w-full"
          className="!text-xs h-full w-full resize-none rounded-none border-none px-2 py-1.5 outline-none focus-within:rounded-none focus-within:border-transparent focus-within:bg-white focus-within:shadow-[inset_0_0_0_1.5px_rgba(0,82,205,1)] focus:outline-none focus:ring-0 dark:focus-within:bg-theme-grey-200"
        />
        {(isNullable || hasDefault) && (
          <CellResetButtons
            isNullable={isNullable}
            hasDefault={hasDefault}
            onSetNull={() => onSave?.(null, { reset: 'null' })}
            onSetDefault={() => onSave?.(null, { reset: 'default' })}
            className="absolute right-1 bottom-1"
          />
        )}
      </div>
    );
  }

  if (!optimisticValue) {
    return (
      <p className="!text-xs truncate text-[#7d8ca3]">
        {optimisticValue === '' ? 'empty' : 'null'}
      </p>
    );
  }

  return (
    <p className="truncate text-xs">
      {displayOptimisticValue}
    </p>
  );
}

import { Copy } from 'lucide-react';
import type {
  CSSProperties,
  FocusEvent,
  JSXElementConstructor,
  KeyboardEvent,
  MouseEvent,
  PropsWithChildren,
  ReactElement,
  ReactNode,
  ReactPortal,
} from 'react';
import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useState,
} from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { useTooltip } from '@/components/ui/v2/Tooltip';
import { Button } from '@/components/ui/v3/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { useTablePath } from '@/features/orgs/projects/database/common/hooks/useTablePath';
import type {
  ColumnType,
  DataBrowserGridCell,
  DataBrowserGridCellProps,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { cn, isNotEmptyValue } from '@/lib/utils';
import { copy } from '@/utils/copy';
import { triggerToast } from '@/utils/toast';
import DataGridCellProvider from './DataGridCellProvider';
import useDataGridCell from './useDataGridCell';

// biome-ignore lint/suspicious/noExplicitAny: TODO
export interface CommonDataGridCellProps<TData extends object, TValue = any>
  extends DataBrowserGridCellProps<TData, TValue> {
  /**
   * Function that is called when the cell is saved.
   */
  onSave?: (value: TValue, options?: { reset: boolean }) => Promise<void>;
  /**
   * Optimistic value for the cell.
   */
  optimisticValue?: TValue;
  /**
   * Function to be called when the optimistic value should be changed.
   */
  onOptimisticValueChange?: (value: TValue) => void;
  /**
   * Temporary value for the cell. This is used for storing the current input
   * value, that should be later saved as an optimistic value before saving the
   * data.
   */
  temporaryValue?: TValue;
  /**
   * Function to be called when the temporary value should be changed.
   */
  onTemporaryValueChange?: (value: TValue) => void;
}

export interface DataGridCellProps<TData extends object> {
  /**
   * Current cell's props.
   */
  // biome-ignore lint/suspicious/noExplicitAny: TODO
  cell: DataBrowserGridCell<TData, any>;
  /**
   * Determines whether the cell is editable.
   */
  isEditable?: boolean;
  /**
   * Determines the column's type.
   */
  columnType?: ColumnType;
  className?: string;
  id?: string;
  style?: CSSProperties;
}

function DataGridCellContent<TData extends object = {}>({
  isEditable,
  children,
  className,
  cell: {
    value: originalValue,
    column: { onCellEdit, id, isNullable, isPrimary, type },
    row,
  },
  ...props
}: PropsWithChildren<DataGridCellProps<TData>>) {
  const { openAlertDialog } = useDialog();
  const tablePath = useTablePath();
  const cellId = `${tablePath}_${id}_${row.id}`;

  const {
    title: tooltipTitle,
    open: tooltipOpen,
    openTooltip,
    closeTooltip,
    resetTooltipTitle,
  } = useTooltip();

  const [optimisticValue, setOptimisticValue] = useState(originalValue);
  const [temporaryValue, setTemporaryValue] = useState(originalValue);

  useEffect(() => {
    setOptimisticValue(originalValue);
    setTemporaryValue(originalValue);
  }, [originalValue]);

  const {
    cellRef,
    inputRef,
    focusCell,
    focusInput,
    blurInput,
    clickInput,
    isEditing,
    isSelected,
    selectCell,
    deselectCell,
    cancelEditCell,
    editCell,
    focusPrevCell,
    focusNextCell,
  } = useDataGridCell();

  function activateInput() {
    if (isPrimary) {
      openTooltip("Primary keys can't be edited.");

      return;
    }

    editCell();

    if (type === 'boolean') {
      clickInput();
    } else {
      focusInput();
    }
  }

  async function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (!isEditable || isEditing || isPrimary) {
      return;
    }

    if (event.detail === 2 && type !== 'boolean') {
      editCell();
      await focusInput();
    }
  }

  function handleFocus() {
    if (!isEditable) {
      return;
    }

    selectCell();
  }

  async function handleSave(
    // biome-ignore lint/suspicious/noExplicitAny: TODO
    value: any,
    options: { reset: boolean } = { reset: false },
  ) {
    if (!onCellEdit) {
      return;
    }

    const normalizedValue =
      value !== null && typeof value === 'object'
        ? JSON.stringify(value)
        : String(value);

    const normalizedOptimisticValue =
      optimisticValue !== null && typeof optimisticValue === 'object'
        ? JSON.stringify(optimisticValue)
        : String(optimisticValue);

    // We are making sure that optimistic value is not equal to the current
    // value. If it is, we are not going to save the value.
    if (
      normalizedValue.replace(/\n/gi, '\\n') ===
        normalizedOptimisticValue.replace(/\n/gi, '\\n') &&
      !options.reset
    ) {
      return;
    }

    // In case of an error, we need to reset optimistic value
    const latestOptimisticValue = optimisticValue;

    setOptimisticValue(value);

    try {
      const data = await onCellEdit({
        row,
        columnsToUpdate: {
          [id]: {
            value: !options.reset ? value : undefined,
            reset: options.reset,
          },
        },
      });

      focusCell();
      cancelEditCell();
      // Syncing optimistic value with server-side value
      setTemporaryValue(data.original[id.toString()]);
      setOptimisticValue(data.original[id.toString()]);
    } catch (error) {
      triggerToast(`Error: ${error.message || 'Unknown error occurred.'}`);

      // Resetting values
      setTemporaryValue(latestOptimisticValue);
      setOptimisticValue(latestOptimisticValue);
      activateInput();
    }
  }

  async function handleBlur(event: FocusEvent<HTMLDivElement>) {
    // We are deselecting cell only if focus target is not a descendant of it.
    const isTargetDropdownMenu =
      event.relatedTarget?.id === cellId ||
      event.relatedTarget?.parentElement?.id === cellId;

    if (
      !isEditable ||
      event.currentTarget.contains(event.relatedTarget) ||
      (isEditing && type === 'boolean' && isTargetDropdownMenu)
    ) {
      return;
    }

    if (type !== 'boolean') {
      await handleSave(temporaryValue);
    }
    if (tooltipOpen) {
      closeTooltip();
    }
    deselectCell();
  }

  function resetCell() {
    if (isPrimary) {
      openTooltip('Primary keys are non-nullable.');

      return;
    }

    if (!isNullable) {
      openTooltip(
        <span>
          <strong>{id}</strong> is non-nullable.
        </span>,
      );

      return;
    }

    openAlertDialog({
      title: 'Set value to null',
      payload: (
        <p>
          Are you sure you want to set this cell to <strong>null</strong>?
        </p>
      ),
      props: {
        primaryButtonText: 'Set to null',
        primaryButtonColor: 'error',
        onPrimaryAction: async () => {
          await handleSave(null, { reset: true });
          focusCell();
        },
      },
    });
  }

  async function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!isEditable) {
      return;
    }

    if (event.key === 'Escape') {
      closeTooltip();
    }

    // Resetting temporary value and focusing cell on Escape when input field is
    // focused
    if (event.key === 'Escape' && event.target === inputRef.current) {
      setTemporaryValue(optimisticValue);
      await focusCell();
      cancelEditCell();
    }

    // Activating input field on Enter
    if (event.key === 'Enter' && event.target === cellRef.current) {
      activateInput();
    }

    // Focusing next cell on Tab
    if (event.key === 'Tab' && !event.shiftKey) {
      event.stopPropagation();
      const nextCellAvailable = focusNextCell();

      if (!nextCellAvailable) {
        event.preventDefault();
        event.stopPropagation();
        await blurInput();
        await focusCell();
      }
    }

    // Focusing previous cell on Shift-Tab
    if (event.key === 'Tab' && event.shiftKey) {
      event.stopPropagation();
      const prevCellAvailable = focusPrevCell();

      if (!prevCellAvailable) {
        event.preventDefault();
        event.stopPropagation();
        await blurInput();
        await focusCell();
      }
    }

    // Initiating cell reset when cell is focused
    if (event.key === 'Backspace' && event.target === cellRef.current) {
      resetCell();
    }
  }

  const content = (
    // biome-ignore lint/a11y/useSemanticElements: need to add event handler to static element
    <div
      ref={cellRef}
      className={cn(
        'relative grid w-full cursor-default grid-flow-col items-center gap-1 border-divider px-2 py-1.5 text-primary-text',
        isEditable &&
          'focus-within:outline-none focus-within:ring-0 focus:ring-0',
        isSelected && 'shadow-outline',
        isEditing && 'shadow-outline-dark',
        className,
      )}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      tabIndex={isEditable ? 0 : undefined}
      onClick={handleClick}
      role="textbox"
      {...props}
    >
      {Children.map(
        children,
        (
          child:
            | ReactNode
            | ReactPortal
            // biome-ignore lint/suspicious/noExplicitAny: TODO
            | ReactElement<unknown, string | JSXElementConstructor<any>>,
        ) => {
          if (!isValidElement(child)) {
            return null;
          }
          const clonedChild = cloneElement(child, {
            ...child.props,
            onSave: handleSave,
            optimisticValue,
            onOptimisticValueChange: setOptimisticValue,
            temporaryValue,
            onTemporaryValueChange: setTemporaryValue,
            cellId,
          });

          return (
            <>
              {clonedChild}
              {id !== 'preview-column' &&
                type !== 'boolean' &&
                isNotEmptyValue(optimisticValue) && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={(event) => {
                      event.stopPropagation();

                      const copiableValue =
                        typeof optimisticValue === 'object'
                          ? JSON.stringify(optimisticValue)
                          : String(optimisticValue).replace(/\\n/gi, '\n');

                      copy(copiableValue, 'Value');
                    }}
                    className="-ml-px h-6 w-6 border-transparent bg-transparent p-1 text-disabled opacity-0 hover:bg-transparent group-hover:opacity-100"
                    aria-label="Copy value"
                  >
                    <Copy width={16} height={16} />
                  </Button>
                )}
            </>
          );
        },
      )}
    </div>
  );
  // TODO: https://github.com/nhost/nhost/issues/3677
  if (isEditable) {
    return (
      <Tooltip
        delayDuration={100}
        open={tooltipOpen}
        onOpenChange={(newState) => {
          if (!newState) {
            resetTooltipTitle();
          }
        }}
      >
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent>{tooltipTitle}</TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

export default function DataGridCell<TData extends object>(
  props: PropsWithChildren<DataGridCellProps<TData>>,
) {
  return (
    <DataGridCellProvider>
      <DataGridCellContent {...props} />
    </DataGridCellProvider>
  );
}

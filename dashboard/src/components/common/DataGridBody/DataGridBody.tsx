import type { DataGridProps } from '@/components/common/DataGrid';
import DataGridCell from '@/components/common/DataGridCell';
import useDataGridConfig from '@/hooks/useDataGridConfig';
import type { DataBrowserGridColumn } from '@/types/dataBrowser';
import Button from '@/ui/v2/Button';
import PlusIcon from '@/ui/v2/icons/PlusIcon';
import type { DetailedHTMLProps, HTMLProps, KeyboardEvent } from 'react';
import { Fragment, useMemo, useRef } from 'react';
import type { Row } from 'react-table';
import { twMerge } from 'tailwind-merge';

export interface DataGridBodyProps<T extends object>
  extends Omit<
      DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement>,
      'children'
    >,
    Pick<DataGridProps<T>, 'onInsertRow' | 'emptyStateMessage' | 'loading'> {
  /**
   * Determines whether column insertion is allowed.
   */
  allowInsertColumn?: boolean;
}

interface InsertPlaceholderTableRowProps
  extends DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement> {
  /**
   * Function to be called when the user wants to insert a new row.
   */
  onInsertRow: VoidFunction;
}

function InsertPlaceholderTableRow({
  onInsertRow,
  ...props
}: InsertPlaceholderTableRowProps) {
  return (
    <div
      className="h-12 bg-white border-gray-200 border-r-1 border-b-1"
      {...props}
    >
      <Button
        onClick={onInsertRow}
        variant="borderless"
        color="secondary"
        className="justify-start w-full h-full px-2 py-3 text-xs font-normal rounded-none hover:shadow-none focus:shadow-none focus:outline-none"
        startIcon={<PlusIcon className="w-4 h-4 text-greyscaleGrey" />}
      >
        Insert New Row
      </Button>
    </div>
  );
}

// TODO: Get rid of Data Browser related code from here. This component should
// be generic and not depend on Data Browser related data types and logic.
export default function DataGridBody<T extends object>({
  emptyStateMessage = 'No data is available',
  loading,
  onInsertRow,
  allowInsertColumn,
  ...props
}: DataGridBodyProps<T>) {
  const { getTableBodyProps, totalColumnsWidth, rows, prepareRow, columns } =
    useDataGridConfig<T>();

  const SELECTION_CELL_WIDTH = 32;
  const ADD_COLUMN_CELL_WIDTH = 100;
  const bodyRef = useRef<HTMLDivElement>();

  const primaryAndUniqueKeys = useMemo(
    () =>
      columns
        .filter(
          (column: DataBrowserGridColumn<T>) =>
            column.isPrimary || column.isUnique,
        )
        .map((column) => column.id),
    [columns],
  );

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>, row: Row<T>) {
    const { id: rowId } = row;
    const cellId = document.activeElement.id;

    const currentRow = bodyRef.current.children.namedItem(rowId);

    if (event.key === 'ArrowUp') {
      event.preventDefault();

      if (!currentRow.previousElementSibling) {
        return;
      }

      const cellInPreviousRow =
        currentRow.previousElementSibling.children.namedItem(cellId);

      if (cellInPreviousRow instanceof HTMLElement) {
        cellInPreviousRow.scrollIntoView({
          block: 'nearest',
        });
        cellInPreviousRow.focus();
      }
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();

      if (!currentRow.nextElementSibling) {
        return;
      }

      const cellInNextRow =
        currentRow.nextElementSibling.children.namedItem(cellId);

      if (cellInNextRow instanceof HTMLElement) {
        cellInNextRow.scrollIntoView({ block: 'nearest' });
        cellInNextRow.focus();
      }
    }

    if (event.key === 'ArrowLeft' || (event.shiftKey && event.key === 'Tab')) {
      let previousFocusableCellInRow: HTMLElement;
      let previousFocusableCellInRowFound = false;

      currentRow.childNodes.forEach((node) => {
        if (node === currentRow.children.namedItem(cellId)) {
          previousFocusableCellInRowFound = true;
        }

        if (
          node instanceof HTMLElement &&
          node.tabIndex > -1 &&
          !previousFocusableCellInRowFound
        ) {
          previousFocusableCellInRow = node;
        }
      });

      if (previousFocusableCellInRow) {
        event.preventDefault();

        previousFocusableCellInRow.scrollIntoView({
          block: 'nearest',
          inline: 'center',
        });
        previousFocusableCellInRow.focus();
      }
    }

    if (
      event.key === 'ArrowRight' ||
      (!event.shiftKey && event.key === 'Tab')
    ) {
      let nextFocusableCellInRow: HTMLElement;
      let nextFocusableCellInRowFound = false;

      currentRow.childNodes.forEach((node) => {
        if (
          node instanceof HTMLElement &&
          node.tabIndex > -1 &&
          parseInt(node.id, 10) > parseInt(cellId, 10) &&
          !nextFocusableCellInRowFound
        ) {
          nextFocusableCellInRowFound = true;
          nextFocusableCellInRow = node;
        }
      });

      if (nextFocusableCellInRow) {
        event.preventDefault();

        nextFocusableCellInRow.scrollIntoView({
          block: 'nearest',
          inline: 'center',
        });
        nextFocusableCellInRow.focus();
      }
    }
  }

  return (
    <div {...getTableBodyProps()} ref={bodyRef} {...props}>
      {rows.length === 0 && !loading && (
        <div className="flex pr-5 flex-nowrap">
          {onInsertRow ? (
            <InsertPlaceholderTableRow
              style={{
                width: allowInsertColumn
                  ? totalColumnsWidth + ADD_COLUMN_CELL_WIDTH
                  : totalColumnsWidth - SELECTION_CELL_WIDTH,
              }}
              onInsertRow={onInsertRow}
            />
          ) : (
            <div
              className="inline-flex h-12 items-center border-b-1 border-r-1 border-gray-200 bg-white py-1.5 px-2 text-xs text-greyscaleGrey"
              style={{
                width: allowInsertColumn
                  ? totalColumnsWidth + ADD_COLUMN_CELL_WIDTH
                  : totalColumnsWidth,
              }}
            >
              {emptyStateMessage}
            </div>
          )}
        </div>
      )}

      {rows.map((row, index) => {
        let rowKey = index.toString();

        if (primaryAndUniqueKeys && primaryAndUniqueKeys.length > 0) {
          rowKey = primaryAndUniqueKeys
            .map((key) => row.values[key])
            .filter(Boolean)
            .join('-');
        } else {
          rowKey = `${index}-${Object.keys(row.values)
            .map((key) => String(row.values[key]))
            .join('-')}`;
        }

        prepareRow(row);

        const rowProps = row.getRowProps({
          style: {
            width: allowInsertColumn
              ? totalColumnsWidth + ADD_COLUMN_CELL_WIDTH
              : totalColumnsWidth,
          },
        });

        return (
          <Fragment key={rowKey.toString()}>
            <div
              {...rowProps}
              id={row.id}
              className="flex scroll-mt-10"
              role="row"
              onKeyDown={(event) => handleKeyDown(event, row)}
              tabIndex={-1}
            >
              {row.cells.map((cell, cellIndex) => {
                const column = cell.column as DataBrowserGridColumn<T>;
                const isCellDisabled =
                  cell.value !== 0 &&
                  !cell.value &&
                  column.type !== 'boolean' &&
                  column.id !== 'selection' &&
                  column.isDisabled;

                return (
                  <DataGridCell
                    {...cell.getCellProps({
                      style: {
                        display: 'inline-flex',
                        alignItems: 'center',
                      },
                    })}
                    cell={cell}
                    className={twMerge(
                      'h-12 font-display text-xs motion-safe:transition-colors',
                      'border-r-1 border-b-1 border-gray-200',
                      'scroll-mt-[57px] scroll-ml-8',
                      column.id === 'selection' &&
                        'sticky left-0 z-20 justify-center bg-white px-0',
                      isCellDisabled
                        ? 'text-greyscaleGrey'
                        : 'text-greyscaleDark',
                      column.isDisabled && 'bg-gray-100',
                    )}
                    isEditable={!column.isDisabled && column.isEditable}
                    id={cellIndex.toString()}
                    key={column.id}
                  >
                    {cell.render('Cell')}
                  </DataGridCell>
                );
              })}

              {allowInsertColumn && (
                <div className="h-12 bg-white border-gray-200 w-25 border-r-1 border-b-1" />
              )}
            </div>

            {onInsertRow && index === rows.length - 1 && (
              <InsertPlaceholderTableRow
                {...rowProps}
                key=""
                onInsertRow={onInsertRow}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

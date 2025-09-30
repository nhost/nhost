import { Box } from '@/components/ui/v2/Box';
import type { DataBrowserGridColumn } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type { DataGridProps } from '@/features/orgs/projects/storage/dataGrid/components/DataGrid/DataGrid';
import { DataGridCell } from '@/features/orgs/projects/storage/dataGrid/components/DataGridCell';
import { useDataGridConfig } from '@/features/orgs/projects/storage/dataGrid/components/DataGridConfigProvider';
import { isNotEmptyValue } from '@/lib/utils';
import type { DetailedHTMLProps, HTMLProps, KeyboardEvent } from 'react';
import { useRef } from 'react';
import type { Row } from 'react-table';
import { twMerge } from 'tailwind-merge';

export interface DataGridBodyProps<T extends object>
  extends Omit<
      DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement>,
      'children'
    >,
    Pick<DataGridProps<T>, 'emptyStateMessage' | 'loading'> {
  /**
   * Determines whether column insertion is allowed.
   */
  allowInsertColumn?: boolean;
}

// TODO: Get rid of Data Browser related code from here. This component should
// be generic and not depend on Data Browser related data types and logic.
export default function DataGridBody<T extends object>({
  emptyStateMessage = 'No data is available',
  loading,
  allowInsertColumn,
  ...props
}: DataGridBodyProps<T>) {
  const { getTableBodyProps, totalColumnsWidth, rows, prepareRow } =
    useDataGridConfig<T>();

  const bodyRef = useRef<HTMLDivElement | null>(null);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>, row: Row<T>) {
    const { id: rowId } = row;
    const cellId = document.activeElement!.id;

    const currentRow = bodyRef.current?.children.namedItem(rowId);

    if (isNotEmptyValue(currentRow)) {
      if (event.key === 'ArrowUp') {
        event.preventDefault();

        if (!currentRow!.previousElementSibling) {
          return;
        }

        const cellInPreviousRow =
          currentRow!.previousElementSibling.children.namedItem(cellId);

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

      if (
        event.key === 'ArrowLeft' ||
        (event.shiftKey && event.key === 'Tab')
      ) {
        const previousFocusableCellInRow = Array.from(currentRow.childNodes)
          .slice(
            0,
            Array.from(currentRow.childNodes).indexOf(
              currentRow.children.namedItem(cellId)!,
            ),
          )
          .reduce<HTMLElement | null>(
            (lastFocusable, node) =>
              node instanceof HTMLElement && node.tabIndex > -1
                ? node
                : lastFocusable,
            null,
          );

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
        const nextFocusableCellInRow = Array.from(
          currentRow.childNodes,
        ).reduce<HTMLElement | null>((result, node) => {
          if (
            node instanceof HTMLElement &&
            node.tabIndex > -1 &&
            parseInt(node.id, 10) > parseInt(cellId, 10) &&
            !result
          ) {
            return node;
          }

          return result;
        }, null);

        if (isNotEmptyValue(nextFocusableCellInRow)) {
          event.preventDefault();

          nextFocusableCellInRow.scrollIntoView({
            block: 'nearest',
            inline: 'center',
          });
          nextFocusableCellInRow.focus();
        }
      }
    }
  }

  const getBackgroundCellColor = (
    row: Row<T>,
    column: DataBrowserGridColumn<T>,
  ) => {
    // Grey out files not uploaded
    if (!row.values.isUploaded) {
      return 'grey.200';
    }

    if (column.isDisabled) {
      return 'grey.100';
    }

    return 'background.paper';
  };

  return (
    <div {...getTableBodyProps()} ref={bodyRef} {...props}>
      {rows.length === 0 && !loading && (
        <div className="flex flex-nowrap">
          <Box
            className="inline-flex h-12 items-center border-b-1 border-r-1 px-2 py-1.5 text-xs"
            sx={{ color: 'text.secondary' }}
            style={{
              width: totalColumnsWidth,
            }}
          >
            {emptyStateMessage}
          </Box>
        </div>
      )}

      {rows.map((row) => {
        prepareRow(row);

        const rowProps = row.getRowProps({
          style: {
            width: totalColumnsWidth,
          },
        });

        return (
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
                column.id !== 'selection-column' &&
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
                  sx={{
                    backgroundColor: getBackgroundCellColor(row, column),
                    color: isCellDisabled ? 'text.secondary' : 'text.primary',
                  }}
                  className={twMerge(
                    'h-12 font-display text-xs motion-safe:transition-colors',
                    'border-b-1 border-r-1',
                    'scroll-ml-8 scroll-mt-[57px]',
                    column.id === 'selection-column' &&
                      'sticky left-0 z-20 justify-center px-0',
                  )}
                  isEditable={!column.isDisabled && column.isEditable}
                  id={cellIndex.toString()}
                  key={column.id}
                >
                  {cell.render('Cell')}
                </DataGridCell>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

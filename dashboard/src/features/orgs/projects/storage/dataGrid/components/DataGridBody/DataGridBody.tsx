import type { Row } from '@tanstack/react-table';
import type { DetailedHTMLProps, HTMLProps, KeyboardEvent } from 'react';
import { useRef } from 'react';
import type { UnknownDataGridRow } from '@/features/orgs/projects/storage/dataGrid/components/DataGrid';
import type { DataGridProps } from '@/features/orgs/projects/storage/dataGrid/components/DataGrid/DataGrid';
import { DataGridCell } from '@/features/orgs/projects/storage/dataGrid/components/DataGridCell';
import { useDataGridConfig } from '@/features/orgs/projects/storage/dataGrid/components/DataGridConfigProvider';
import { useDataTableDesignContext } from '@/features/orgs/projects/storage/dataGrid/providers/DataTableDesignProvider';
import { cn, isNotEmptyValue } from '@/lib/utils';

export interface DataGridBodyProps<T extends UnknownDataGridRow>
  extends Omit<
      DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement>,
      'children'
    >,
    Pick<DataGridProps<T>, 'emptyStateMessage' | 'loading'> {
  isRowDisabled?: (row: Row<T>) => boolean;
}

// TODO: Get rid of Data Browser related code from here. This component should
// be generic and not depend on Data Browser related data types and logic.
export default function DataGridBody<T extends UnknownDataGridRow>({
  emptyStateMessage = 'No data is available',
  loading,
  isRowDisabled,
  ...props
}: DataGridBodyProps<T>) {
  const table = useDataGridConfig<T>();
  const rows = table.getRowModel().rows;
  const totalColumnsWidth = table.getTotalSize();

  const context = useDataTableDesignContext();

  const bodyRef = useRef<HTMLDivElement | null>(null);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>, rowId: string) {
    const activeElement = document.activeElement as HTMLElement;
    const currentRow = bodyRef.current?.children.namedItem(rowId);

    if (isNotEmptyValue(currentRow) && currentRow.contains(activeElement)) {
      const children = Array.from(currentRow.children) as HTMLElement[];
      const cellIndex = children.indexOf(activeElement);

      if (event.key === 'ArrowUp') {
        event.preventDefault();

        if (!currentRow.previousElementSibling) {
          return;
        }

        const cellInPreviousRow = currentRow.previousElementSibling.children[
          cellIndex
        ] as HTMLElement;

        if (cellInPreviousRow) {
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

        const cellInNextRow = currentRow.nextElementSibling.children[
          cellIndex
        ] as HTMLElement;

        if (cellInNextRow) {
          cellInNextRow.scrollIntoView({ block: 'nearest' });
          cellInNextRow.focus();
        }
      }

      if (
        event.key === 'ArrowLeft' ||
        (event.shiftKey && event.key === 'Tab')
      ) {
        const previousFocusableCellInRow = children
          .slice(0, cellIndex)
          .reverse()
          .find((node) => node.tabIndex > -1);

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
        const nextFocusableCellInRow = children
          .slice(cellIndex + 1)
          .find((node) => node.tabIndex > -1);

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

  return (
    <div ref={bodyRef} {...props}>
      {rows.length === 0 && !loading && (
        <div className="flex flex-nowrap">
          <div
            className="box dark:!text-[#a2b3be] inline-flex h-12 items-center border-r-1 border-b-1 px-2 py-1.5 text-xs"
            style={{
              width: totalColumnsWidth,
            }}
          >
            {emptyStateMessage}
          </div>
        </div>
      )}

      {rows.map((row) => {
        return (
          // biome-ignore lint/a11y/useSemanticElements: A table layout using div
          <div
            key={row.id}
            id={row.id}
            style={{
              height: context.rowDensity === 'comfortable' ? '3rem' : '2rem',
              width: totalColumnsWidth,
            }}
            className={cn(
              'flex scroll-mt-10 border-b-1 border-b-transparent last:border-b-data-table-border-color',
              isRowDisabled?.(row)
                ? 'bg-data-cell-bg-disabled'
                : 'odd:bg-data-cell-bg-odd even:bg-data-cell-bg hover:bg-data-cell-bg-hover',
            )}
            role="row"
            onKeyDown={(event) => handleKeyDown(event, row.id)}
            tabIndex={-1}
          >
            {row.getVisibleCells().map((cell) => (
              <DataGridCell cell={cell} key={cell.id} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

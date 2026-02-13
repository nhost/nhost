import '@tanstack/react-table';
import type { Row, RowData } from '@tanstack/react-table';
import type {
  ColumnType,
  ColumnUpdateOptions,
  ForeignKeyRelation,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

declare module '@tanstack/react-table' {
  interface ColumnMeta<TData extends RowData, TValue> {
    onCellEdit?: (options: {
      row: Row<TData>;
      columnsToUpdate: Record<string, ColumnUpdateOptions>;
    }) => Promise<Row<TData>>;
    isEditable?: boolean;
    isPrimary?: boolean;
    isNullable?: boolean;
    isIdentity?: boolean;
    isUnique?: boolean;
    isDefaultValueCustom?: boolean;
    // biome-ignore lint/suspicious/noExplicitAny: generic value
    defaultValue?: any;
    comment?: string | null;
    uniqueConstraints?: string[];
    primaryConstraints?: string[];
    foreignKeyRelation?: ForeignKeyRelation | null;
    specificType?: ColumnType;
    dataType?: string;
    /**
     * More generic type of the column. Determines what type of input field is
     * rendered.
     */
    type?: string;
  }
}

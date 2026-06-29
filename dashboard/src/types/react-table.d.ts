import '@tanstack/react-table';
import type { Row, RowData } from '@tanstack/react-table';
import type {
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
    // biome-ignore lint/suspicious/noExplicitAny: generic value
    defaultValue?: any;
    comment?: string | null;
    uniqueConstraints?: string[];
    primaryConstraints?: string[];
    foreignKeyRelation?: ForeignKeyRelation | null;
    specificType?: string;
    baseType?: string;
    isArray?: boolean;
    displayType?: string;
  }
}

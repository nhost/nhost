import type { AutocompleteOption } from '@/components/ui/v2/Autocomplete';
import type {
  DatabaseColumn,
  DataBrowserGridColumn,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

/**
 * Converts a data browser grid column to a normalized database column.
 *
 * @param dataBrowserGridColumn - Data browser grid column.
 * @returns Normalized database column.
 */
export default function convertDataGridColumnToDatabaseColumn(
  dataBrowserGridColumn: Partial<DataBrowserGridColumn> &
    Required<Pick<DataBrowserGridColumn, 'id'>>,
): DatabaseColumn {
  let defaultValue: AutocompleteOption = null;

  if (typeof dataBrowserGridColumn.defaultValue === 'string') {
    defaultValue = {
      value: dataBrowserGridColumn.defaultValue,
      label: dataBrowserGridColumn.defaultValue,
      custom: dataBrowserGridColumn.isDefaultValueCustom || false,
    };
  } else if (dataBrowserGridColumn.defaultValue) {
    defaultValue = {
      value: dataBrowserGridColumn.defaultValue.value,
      label: dataBrowserGridColumn.defaultValue.label,
      custom:
        dataBrowserGridColumn.isDefaultValueCustom ||
        dataBrowserGridColumn.defaultValue.custom ||
        false,
    };
  }

  return {
    id: dataBrowserGridColumn.id,
    name: dataBrowserGridColumn.id,
    isIdentity: dataBrowserGridColumn.isIdentity || false,
    isPrimary: dataBrowserGridColumn.isPrimary || false,
    isUnique: dataBrowserGridColumn.isUnique || false,
    isNullable: dataBrowserGridColumn.isNullable || false,
    type: {
      value: dataBrowserGridColumn.specificType,
      label: dataBrowserGridColumn.specificType,
    },
    defaultValue,
    foreignKeyRelation: dataBrowserGridColumn.foreignKeyRelation || null,
    comment: dataBrowserGridColumn.comment || null,
    primaryConstraints: dataBrowserGridColumn.primaryConstraints || [],
    uniqueConstraints: dataBrowserGridColumn.uniqueConstraints || [],
  };
}

import { ArrowRight, X } from 'lucide-react';
import { useFormContext, useWatch } from 'react-hook-form';
import { FormSelect } from '@/components/form/FormSelect';
import { Button } from '@/components/ui/v3/button';
import { SelectItem } from '@/components/ui/v3/select';
import type { DatabaseColumn } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type { BaseForeignKeySchemaValues } from './BaseForeignKeyForm';

export interface ColumnMappingRowProps {
  /** Index of the column pair in the `columnMappings` field array. */
  index: number;
  /** Columns available in the table that owns the foreign key. */
  availableColumns?: DatabaseColumn[];
  /** Column names available in the referenced table. */
  referencedColumnOptions: string[];
  /** Whether a referenced table has been selected yet. */
  hasReferencedTable: boolean;
  /** Whether the row can be removed (disabled for the last remaining row). */
  canRemove: boolean;
  /** Called when the row's remove button is clicked. */
  onRemove: VoidFunction;
  /** Local columns already chosen across all pairs (used to disable duplicates). */
  selectedColumns: Set<string>;
  /** Referenced columns already chosen across all pairs. */
  selectedReferencedColumns: Set<string>;
}

export default function ColumnMappingRow({
  index,
  availableColumns,
  referencedColumnOptions,
  hasReferencedTable,
  canRemove,
  onRemove,
  selectedColumns,
  selectedReferencedColumns,
}: ColumnMappingRowProps) {
  const { control } = useFormContext<BaseForeignKeySchemaValues>();
  const ownColumn = useWatch({
    control,
    name: `columnMappings.${index}.column`,
  });
  const ownReferencedColumn = useWatch({
    control,
    name: `columnMappings.${index}.referencedColumn`,
  });

  return (
    <div className="grid grid-cols-[1fr_auto_1fr_auto] items-start gap-2">
      <FormSelect
        control={control}
        name={`columnMappings.${index}.column`}
        placeholder="Select a column"
        className="border-border"
        contentClassName="z-[1400]"
      >
        {availableColumns?.map(({ name }) => (
          <SelectItem
            value={name}
            key={name}
            disabled={selectedColumns.has(name) && ownColumn !== name}
          >
            {name}
          </SelectItem>
        ))}
      </FormSelect>

      <ArrowRight className="mt-3 h-4 w-4 text-muted-foreground" />

      <FormSelect
        control={control}
        name={`columnMappings.${index}.referencedColumn`}
        placeholder="Select a column"
        disabled={!hasReferencedTable || referencedColumnOptions.length === 0}
        className="border-border"
        contentClassName="z-[1400]"
      >
        {referencedColumnOptions.map((name) => (
          <SelectItem
            value={name}
            key={name}
            disabled={
              selectedReferencedColumns.has(name) &&
              ownReferencedColumn !== name
            }
          >
            {name}
          </SelectItem>
        ))}
      </FormSelect>

      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-10 w-10"
        disabled={!canRemove}
        aria-label="Remove column pair"
        onClick={onRemove}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

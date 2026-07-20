import { ArrowRight } from 'lucide-react';
import { useFormContext, useWatch } from 'react-hook-form';
import { FormSelect } from '@/components/form/FormSelect';
import { SelectItem } from '@/components/ui/v3/select';
import type { DatabaseColumn } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type { BaseForeignKeySchemaValues } from '@/features/orgs/projects/database/dataGrid/components/BaseForeignKeyForm/BaseForeignKeyForm';

export interface ColumnMappingRowProps {
  index: number;
  availableColumns?: DatabaseColumn[];
  selectedColumns: Set<string>;
}

export default function ColumnMappingRow({
  index,
  availableColumns,
  selectedColumns,
}: ColumnMappingRowProps) {
  const { control } = useFormContext<BaseForeignKeySchemaValues>();
  const ownColumn = useWatch({
    control,
    name: `columnMappings.${index}.column`,
  });
  const referencedColumn = useWatch({
    control,
    name: `columnMappings.${index}.referencedColumn`,
  });

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
      <FormSelect
        control={control}
        name={`columnMappings.${index}.column`}
        label={`Local column for ${referencedColumn}`}
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

      <div className="flex h-10 items-center rounded-md border border-border bg-muted px-3 text-sm">
        {referencedColumn}
      </div>
    </div>
  );
}

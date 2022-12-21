import ControlledAutocomplete from '@/components/common/ControlledAutocomplete';
import ControlledSelect from '@/components/common/ControlledSelect';
import useTableQuery from '@/hooks/dataBrowser/useTableQuery';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Button from '@/ui/v2/Button';
import IconButton from '@/ui/v2/IconButton';
import PlusIcon from '@/ui/v2/icons/PlusIcon';
import XIcon from '@/ui/v2/icons/XIcon';
import InputLabel from '@/ui/v2/InputLabel';
import Option from '@/ui/v2/Option';
import Text from '@/ui/v2/Text';
import { useFieldArray, useWatch } from 'react-hook-form';

export interface ColumnPreset {
  column: string;
  value: string;
}

export interface ColumnPresetSectionProps {
  /**
   * Schema to use for fetching available columns.
   */
  schema: string;
  /**
   * Table to use for fetching available columns.
   */
  table: string;
}

export default function ColumnPresetsSection({
  schema,
  table,
}: ColumnPresetSectionProps) {
  const {
    data: tableData,
    status: tableStatus,
    error: tableError,
  } = useTableQuery([`default.${schema}.${table}`], { schema, table });

  const { fields, append, remove } = useFieldArray({ name: 'columnPresets' });
  const columnPresets = useWatch({ name: 'columnPresets' }) as ColumnPreset[];

  const allColumnNames: string[] =
    tableData?.columns.map((column) => column.column_name) || [];
  const selectedColumns = fields as (ColumnPreset & { id: string })[];
  const selectedColumnsMap = columnPresets.reduce(
    (map, { column }) => map.set(column, true),
    new Map<string, boolean>(),
  );

  if (tableError) {
    throw tableError;
  }

  return (
    <section className="bg-white border-y-1 border-gray-200">
      <Text
        component="h2"
        className="px-6 py-3 font-bold border-b-1 border-gray-200"
      >
        Column presets
      </Text>

      <div className="grid grid-flow-row gap-2 items-center px-6 py-4">
        <div className="grid grid-cols-[1fr_1fr_40px] gap-2">
          <InputLabel as="span">Column Name</InputLabel>
          <InputLabel as="span">Column Value</InputLabel>
        </div>

        {tableStatus === 'loading' && (
          <ActivityIndicator label="Loading columns..." />
        )}

        <div className="grid grid-flow-row gap-4">
          {tableStatus === 'success' &&
            selectedColumns.map((field, index) => (
              <div
                key={field.id}
                className="grid grid-cols-[1fr_1fr_40px] gap-2"
              >
                <ControlledSelect name={`columnPresets.${index}.column`}>
                  {allColumnNames.map((column) => (
                    <Option
                      value={column}
                      disabled={selectedColumnsMap.has(column)}
                      key={column}
                    >
                      {column}
                    </Option>
                  ))}
                </ControlledSelect>

                <ControlledAutocomplete
                  freeSolo
                  options={[]}
                  name={`columnPresets.${index}.value`}
                  fullWidth
                />

                <IconButton
                  variant="outlined"
                  color="secondary"
                  className="shrink-0 grow-0 flex-[40px]"
                  onClick={() => remove(index)}
                >
                  <XIcon className="w-4 h-4" />
                </IconButton>
              </div>
            ))}
        </div>

        <Button
          variant="borderless"
          startIcon={<PlusIcon />}
          size="small"
          onClick={() => append({ column: '', type: 'static', value: '' })}
          disabled={selectedColumns.length === allColumnNames.length}
          className="justify-self-start"
        >
          Add Column
        </Button>
      </div>
    </section>
  );
}

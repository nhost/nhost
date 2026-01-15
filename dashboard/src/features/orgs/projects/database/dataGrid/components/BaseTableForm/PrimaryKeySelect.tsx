import { useMemo } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import {
  MultiSelect,
  MultiSelectContent,
  MultiSelectGroup,
  MultiSelectItem,
  MultiSelectTrigger,
  MultiSelectValue,
} from '@/components/ui/v3/multi-select';
import type { DatabaseColumn } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

export default function PrimaryKeySelect() {
  const columns: DatabaseColumn[] = useWatch({ name: 'columns' });

  const { control } = useFormContext();

  // List of columns that can be used as an identity column
  const columnsWithNames = useMemo(
    () =>
      (columns || [])
        .map((column, ind) => ({
          label: column.name,
          value: `${ind}`,
        }))
        .filter(({ label }) => Boolean(label)),
    [columns],
  );

  return (
    <div className="pb- col-span-8 py-3 font-[Inter]">
      <FormField
        control={control}
        name="primaryKeyIndices"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="pb-2 font-bold text-[0.9375rem] leading-5">
              Primary Key
            </FormLabel>
            <MultiSelect onValuesChange={field.onChange} values={field.value}>
              <FormControl>
                <MultiSelectTrigger className="!mt-3 h-10 w-full rounded-sm hover:bg-[#ebf3ff] dark:border-[#2f363d] dark:bg-[#171d26] dark:hover:bg-[#1b2534]">
                  <MultiSelectValue
                    placeholder="Add Primary Key"
                    placeHolderClassName="text-[#9ca7b7]"
                  />
                </MultiSelectTrigger>
              </FormControl>
              <MultiSelectContent className="!rounded-sm">
                <MultiSelectGroup>
                  {columnsWithNames.map((col) => (
                    <MultiSelectItem
                      key={col.value}
                      value={col.value}
                      className="data-[selected='true']:bg-[#ebf3ff] data-[selected='true']:dark:bg-[#1b2534]"
                    >
                      {col.label}
                    </MultiSelectItem>
                  ))}
                </MultiSelectGroup>
              </MultiSelectContent>
            </MultiSelect>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

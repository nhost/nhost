import { useFormContext } from 'react-hook-form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { Checkbox } from '@/components/ui/v3/checkbox';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import { Skeleton } from '@/components/ui/v3/skeleton';
import { useTableSchemaQuery } from '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery';
import type { BaseEventTriggerFormValues } from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm/BaseEventTriggerFormTypes';
import { isEmptyValue } from '@/lib/utils';

interface UpdateTriggerColumnsSectionProps {
  isSheetOpen: boolean;
}

export default function UpdateTriggerColumnsSection({
  isSheetOpen,
}: UpdateTriggerColumnsSectionProps) {
  const form = useFormContext<BaseEventTriggerFormValues>();

  const selectedTableSchema = form.watch('tableSchema');
  const selectedTableName = form.watch('tableName');

  const canFetchColumns =
    isSheetOpen && Boolean(selectedTableSchema && selectedTableName);

  const { data: selectedTableData, isLoading } = useTableSchemaQuery(
    [`default.${selectedTableSchema}.${selectedTableName}`],
    {
      schema: selectedTableSchema,
      table: selectedTableName,
      queryOptions: {
        enabled: canFetchColumns,
      },
    },
  );

  const columns =
    selectedTableData?.columns
      ?.map((column) => (column.column_name as string) ?? null)
      .filter(Boolean) ?? [];

  if (!canFetchColumns) {
    return (
      <Alert variant="destructive" className="max-w-lg">
        <AlertTitle>Table not selected</AlertTitle>
        <AlertDescription>
          Please select a table to list its columns
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-4 w-full max-w-xs" />
        <div className="flex max-w-lg flex-row gap-6">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
        </div>
      </div>
    );
  }

  return (
    <FormField
      control={form.control}
      name="updateTriggerColumns"
      render={({ field }) => (
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-medium text-foreground text-sm">
              List of columns to trigger
            </h3>
          </div>
          <div className="flex flex-row items-center justify-start gap-8">
            {isEmptyValue(columns) ? (
              <p className="text-muted-foreground">
                Select a table first to see the columns
              </p>
            ) : (
              columns.map((column) => (
                <FormItem
                  key={column}
                  className="flex w-auto flex-row items-center space-x-2 space-y-0"
                >
                  <FormControl>
                    <Checkbox
                      id={`column-on-update-${column}`}
                      checked={field.value?.includes(column)}
                      onCheckedChange={(checked) => {
                        const newValue = checked
                          ? [...(field.value ?? []), column]
                          : (field.value ?? []).filter(
                              (value) => value !== column,
                            );
                        field.onChange(newValue);
                      }}
                    />
                  </FormControl>
                  <FormLabel
                    htmlFor={`column-on-update-${column}`}
                    className="cursor-pointer font-normal text-foreground"
                  >
                    {column}
                  </FormLabel>
                </FormItem>
              ))
            )}
          </div>
          <FormMessage />
        </div>
      )}
    />
  );
}

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import { Switch } from '@/components/ui/v3/switch';
import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import useSetTableIsEnumMutation from '@/features/orgs/projects/database/dataGrid/hooks/useSetTableIsEnumMutation/useSetTableIsEnumMutation';
import { useTableIsEnumQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useTableIsEnumQuery';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { cn } from '@/lib/utils';
import SetIsEnumSectionSkeleton from './SetIsEnumSectionSkeleton';

const validationSchema = z.object({
  isEnum: z.boolean(),
});

export interface SetIsEnumSectionProps {
  disabled?: boolean;
  isUntracked?: boolean;
  schema: string;
  tableName: string;
}

export default function SetIsEnumSection({
  disabled,
  isUntracked,
  schema,
  tableName,
}: SetIsEnumSectionProps) {
  const { mutateAsync: setTableIsEnum } = useSetTableIsEnumMutation();
  const {
    data: isEnum,
    isLoading: isLoadingIsEnum,
    refetch: refetchIsEnum,
    error: tableIsEnumError,
    isError: isTableIsEnumError,
  } = useTableIsEnumQuery({
    table: {
      name: tableName,
      schema,
    },
    dataSource: 'default',
  });

  const tableIsEnumErrorMessage =
    tableIsEnumError instanceof Error
      ? tableIsEnumError.message
      : 'An error occurred while loading the table as enum status.';

  const { data: resourceVersion } = useGetMetadataResourceVersion();

  const form = useForm({
    defaultValues: {
      isEnum: Boolean(isEnum),
    },
    resolver: zodResolver(validationSchema),
  });

  const { reset, formState } = form;

  const { isDirty, isSubmitting } = formState;

  useEffect(() => {
    if (isLoadingIsEnum) {
      return;
    }
    reset({
      isEnum: Boolean(isEnum),
    });
  }, [isEnum, reset, isLoadingIsEnum]);

  if (isLoadingIsEnum) {
    return <SetIsEnumSectionSkeleton />;
  }

  const handleFormSubmit = form.handleSubmit(async (values) => {
    const promise = setTableIsEnum({
      resourceVersion,
      args: {
        table: {
          name: tableName,
          schema,
        },
        is_enum: values.isEnum,
        source: 'default',
      },
    });
    const loadingMessage = values.isEnum
      ? 'Setting table as enum...'
      : 'Setting table as not enum...';
    const successMessage = values.isEnum
      ? 'Table set as enum successfully.'
      : 'Table set as not enum successfully.';
    const errorMessage = values.isEnum
      ? 'An error occurred while setting table as enum.'
      : 'An error occurred while setting table as not enum.';

    await execPromiseWithErrorToast(() => promise, {
      loadingMessage,
      successMessage,
      errorMessage,
    });
    await refetchIsEnum();
  });

  return (
    <Form {...form}>
      <form
        onSubmit={handleFormSubmit}
        className="flex flex-col gap-4 px-6 pb-4"
      >
        <div className="box grid grid-flow-row gap-4 overflow-hidden rounded-lg border-1 py-4">
          <div className="grid grid-flow-col place-content-between gap-3 px-4">
            <div className="grid grid-flow-col gap-4">
              <div className="grid grid-flow-row gap-1">
                <h2 className="font-semibold text-lg">Set Table as Enum</h2>

                <p className="text-muted-foreground text-sm+">
                  Expose the table values as GraphQL enums in the GraphQL API
                </p>
              </div>
            </div>
          </div>
          {isTableIsEnumError ? (
            <div className="px-4">
              <Alert variant="destructive">
                <AlertTitle>Unable to load table is enum</AlertTitle>
                <AlertDescription>
                  {tableIsEnumErrorMessage && <p>{tableIsEnumErrorMessage}</p>}
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <div className="px-4">
              <div className="grid gap-2 rounded-md border border-border bg-muted/30 px-4 py-3 text-muted-foreground text-sm">
                <p className="font-medium text-foreground">Requirements</p>
                <ul className="grid list-disc gap-1 pl-5">
                  <li>
                    Use a single-column primary key of type <code>text</code>{' '}
                    whose values are valid GraphQL enum names.
                  </li>
                  <li>
                    Optionally add a second <code>text</code> column to describe
                    each enum value in the GraphQL schema.
                  </li>
                  <li>Do not add any additional columns to the table.</li>
                  <li>Ensure the table contains at least one row.</li>
                </ul>
              </div>
              <FormField
                control={form.control}
                name="isEnum"
                render={({ field }) => (
                  <FormItem className="space-y-4 pt-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="grid gap-1">
                        <FormLabel className="font-medium text-base">
                          Is Enum
                        </FormLabel>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={disabled || isUntracked}
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}
          {isUntracked && (
            <p className="px-4 text-muted-foreground text-sm">
              Track this table to customize its GraphQL settings.
            </p>
          )}
          {!disabled && !isUntracked && (
            <div className="grid grid-flow-col items-center justify-end gap-x-2 border-t px-4 pt-3.5">
              <ButtonWithLoading
                variant={isDirty ? 'default' : 'outline'}
                type="submit"
                disabled={!isDirty || isTableIsEnumError}
                loading={isSubmitting}
                className={cn('text-sm+', { 'text-white': isDirty })}
              >
                Save
              </ButtonWithLoading>
            </div>
          )}
        </div>
      </form>
    </Form>
  );
}

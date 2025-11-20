import { SettingsContainer } from '@/components/layout/SettingsContainer';
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
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import useSetTableIsEnumMutation from '../../../hooks/useSetTableIsEnumMutation/useSetTableIsEnumMutation';
import { useTableIsEnumQuery } from '../../../hooks/useTableIsEnumQuery';

const validationSchema = z.object({
  isEnum: z.boolean(),
});

export interface SetIsEnumFormProps {
  schema: string;
  tableName: string;
}

export default function SetIsEnumForm({
  schema,
  tableName,
}: SetIsEnumFormProps) {
  const { mutateAsync: setTableIsEnum } = useSetTableIsEnumMutation();
  const {
    data: isEnum,
    isLoading: isLoadingIsEnum,
    refetch: refetchIsEnum,
  } = useTableIsEnumQuery({
    table: {
      name: tableName,
      schema,
    },
    dataSource: 'default',
  });

  const { data: resourceVersion } = useGetMetadataResourceVersion();

  const form = useForm({
    defaultValues: {
      isEnum: Boolean(isEnum),
    },
    resolver: zodResolver(validationSchema),
  });

  const { formState } = form;

  useEffect(() => {
    if (isLoadingIsEnum) {
      return;
    }
    form.reset({
      isEnum: Boolean(isEnum),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnum, isLoadingIsEnum]);

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
      <form onSubmit={handleFormSubmit} className="flex flex-col gap-4 px-6 pb-4">
        <SettingsContainer
          title="Set Table as Enum"
          description="Expose the table values as GraphQL enums in the GraphQL API"
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty,
              loading: formState.isSubmitting,
            },
          }}
        >
          <div className="grid gap-2 rounded-md border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Requirements</p>
            <ul className="grid list-disc gap-1 pl-5">
              <li>
                Use a single-column primary key of type <code>text</code> whose
                values are valid GraphQL enum names.
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
              <FormItem className="space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="grid gap-1">
                    <FormLabel className="text-base font-medium">
                      Is Enum
                    </FormLabel>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </SettingsContainer>
      </form>
    </Form>
  );
}

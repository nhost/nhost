import { yupResolver } from '@hookform/resolvers/yup';
import { InfoIcon, PlusIcon, RefreshCwIcon } from 'lucide-react';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { Box } from '@/components/ui/v2/Box';
import { Input } from '@/components/ui/v2/Input';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { Button } from '@/components/ui/v3/button';
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
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { DialogFormProps } from '@/types/common';
import {
  useInsertFileStoreMutation,
  useUpdateFileStoreMutation,
} from '@/utils/__generated__/graphite.graphql';
import { useGetBucketsQuery } from '@/utils/__generated__/graphql';
import { type DeepRequired, removeTypename } from '@/utils/helpers';

export const validationSchema = Yup.object({
  name: Yup.string().required('The name is required'),
  buckets: Yup.array()
    .of(
      Yup.object({
        label: Yup.string(),
        value: Yup.string(),
      }),
    )
    .label('Buckets')
    .required('At least one bucket is required'),
});

export type FileStoreFormValues = Yup.InferType<typeof validationSchema>;

export interface FileStoreFormProps extends DialogFormProps {
  id?: string;
  initialData?: Omit<FileStoreFormValues, 'buckets'> & { buckets: string[] };
  onSubmit?: () => Promise<unknown>;
  onCancel?: VoidFunction;
}

export default function FileStoreForm({
  id,
  initialData,
  onSubmit,
  onCancel,
  location,
}: FileStoreFormProps) {
  const { onDirtyStateChange } = useDialog();

  const remoteProjectGQLClient = useRemoteApplicationGQLClient();

  const [insertFileStore] = useInsertFileStoreMutation({
    client: remoteProjectGQLClient,
  });

  const [updateFileStore] = useUpdateFileStoreMutation({
    client: remoteProjectGQLClient,
  });

  const { data: buckets } = useGetBucketsQuery({
    client: remoteProjectGQLClient,
  });

  const bucketOptions = buckets
    ? buckets.buckets.map((bucket) => ({
        label: bucket.id,
        value: bucket.id,
      }))
    : [];

  const formDefaultValues = {
    ...initialData,
    buckets: [] as { label: string; value: string }[],
  };
  formDefaultValues.buckets = initialData?.buckets
    ? initialData.buckets.map((bucket) => ({
        label: bucket,
        value: bucket,
      }))
    : [];

  const form = useForm<FileStoreFormValues>({
    defaultValues: formDefaultValues,
    reValidateMode: 'onSubmit',
    resolver: yupResolver(validationSchema),
  });

  const {
    register,
    formState: { errors, isSubmitting, dirtyFields },
  } = form;

  const isDirty = Object.keys(dirtyFields).length > 0;

  useEffect(() => {
    onDirtyStateChange(isDirty, location);
  }, [isDirty, location, onDirtyStateChange]);

  const createOrUpdateFileStore = async (
    values: DeepRequired<FileStoreFormValues> & { id: string },
  ) => {
    const payload = removeTypename(values);
    delete payload.id;
    delete payload.vectorStoreID;

    if (id) {
      await updateFileStore({
        variables: {
          id,
          object: { ...payload, buckets: values.buckets.map((b) => b.value) },
        },
      });

      return;
    }

    await insertFileStore({
      variables: {
        object: { ...values, buckets: values.buckets.map((b) => b.value) },
      },
    });
  };

  const handleSubmit = async (
    values: DeepRequired<FileStoreFormValues> & { id: string },
  ) => {
    await execPromiseWithErrorToast(
      async () => {
        await createOrUpdateFileStore(values);
        onSubmit?.();
      },
      {
        loadingMessage: 'Creating File Store...',
        successMessage: 'The File Store has been created successfully.',
        errorMessage:
          'An error occurred while creating the File Store. Please try again.',
      },
    );
  };

  return (
    <FormProvider {...form}>
      <Form
        onSubmit={handleSubmit}
        className="flex h-full flex-col overflow-hidden border-t"
      >
        <div className="flex flex-1 flex-col space-y-4 overflow-auto p-4">
          <Input
            {...register('name')}
            id="name"
            label={
              <Box className="flex flex-row items-center space-x-2">
                <Text>Name</Text>
                <Tooltip title="Name of the file store">
                  <InfoIcon
                    aria-label="Info"
                    className="h-4 w-4 text-primary"
                  />
                </Tooltip>
              </Box>
            }
            placeholder=""
            hideEmptyHelperText
            error={!!errors.name}
            helperText={errors?.name?.message}
            fullWidth
            autoComplete="off"
            autoFocus
          />

          <FormField
            control={form.control}
            name="buckets"
            render={({ field }) => (
              <FormItem className="flex flex-col gap-2">
                <FormLabel>
                  <Box className="flex flex-row items-center space-x-2">
                    <Text>Buckets</Text>
                    <Tooltip title="One or more buckets from storage from which documents can be used by Assistants">
                      <InfoIcon
                        aria-label="Info"
                        className="h-4 w-4 text-primary"
                      />
                    </Tooltip>
                  </Box>
                </FormLabel>
                <MultiSelect
                  values={(field.value || []).map(
                    // biome-ignore lint/suspicious/noExplicitAny: Will be fixed later.
                    (v: any) => v.value,
                  )}
                  onValuesChange={(nextValues) =>
                    field.onChange(
                      nextValues.map((v) => ({ label: v, value: v })),
                    )
                  }
                >
                  <FormControl>
                    <MultiSelectTrigger className="w-full rounded-sm hover:bg-accent-background dark:border-[#2f363d] dark:bg-[#171d26] dark:hover:bg-[#1b2534]">
                      <MultiSelectValue
                        placeholder="Select Buckets"
                        placeHolderClassName="text-[#9ca7b7]"
                      />
                    </MultiSelectTrigger>
                  </FormControl>
                  <MultiSelectContent>
                    <MultiSelectGroup>
                      {bucketOptions.map((opt) => (
                        <MultiSelectItem
                          key={opt.value}
                          value={opt.value}
                          className="data-[selected='true']:bg-accent data-[selected='true']:dark:bg-[#1b2534]"
                        >
                          {opt.label}
                        </MultiSelectItem>
                      ))}
                    </MultiSelectGroup>
                  </MultiSelectContent>
                </MultiSelect>
                {!!errors.buckets && (
                  <FormMessage>{errors.buckets.message}</FormMessage>
                )}
              </FormItem>
            )}
          />
        </div>

        <Box className="flex w-full flex-row justify-between rounded border-t p-4">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {id ? (
              <RefreshCwIcon className="mr-2 h-4 w-4" />
            ) : (
              <PlusIcon className="mr-2 h-4 w-4" />
            )}
            {id ? 'Update' : 'Create'}
          </Button>
        </Box>
      </Form>
    </FormProvider>
  );
}

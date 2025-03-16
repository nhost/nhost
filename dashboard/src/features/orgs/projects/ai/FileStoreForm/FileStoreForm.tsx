import { useDialog } from '@/components/common/DialogProvider';
import { ControlledAutocomplete } from '@/components/form/ControlledAutocomplete';
import { Form } from '@/components/form/Form';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { ArrowsClockwise } from '@/components/ui/v2/icons/ArrowsClockwise';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { Input } from '@/components/ui/v2/Input';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import { useAdminApolloClient } from '@/features/orgs/projects/hooks/useAdminApolloClient';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { DialogFormProps } from '@/types/common';
import {
  useInsertFileStoreMutation,
  useUpdateFileStoreMutation,
} from '@/utils/__generated__/graphite.graphql';
import { useGetBucketsQuery } from '@/utils/__generated__/graphql';
import { removeTypename, type DeepRequired } from '@/utils/helpers';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

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
  onSubmit?: VoidFunction | ((args?: any) => Promise<any>);
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

  const { adminClient } = useAdminApolloClient();

  const [insertFileStore] = useInsertFileStoreMutation({
    client: adminClient,
  });

  const [updateFileStore] = useUpdateFileStoreMutation({
    client: adminClient,
  });

  const remoteProjectGQLClient = useRemoteApplicationGQLClient();
  const { data: buckets } = useGetBucketsQuery({
    client: remoteProjectGQLClient,
  });

  const bucketOptions = buckets
    ? buckets.buckets.map((bucket) => ({
        label: bucket.id,
        value: bucket.id,
      }))
    : [];

  const formDefaultValues = { ...initialData, buckets: [] };
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
                    className="h-4 w-4"
                    color="primary"
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

          <ControlledAutocomplete
            id="buckets"
            name="buckets"
            label={
              <Box className="flex flex-row items-center space-x-2">
                <Text>Buckets</Text>
                <Tooltip title="One or more buckets from storage from which documents can be used by Assistants">
                  <InfoIcon
                    aria-label="Info"
                    className="h-4 w-4"
                    color="primary"
                  />
                </Tooltip>
              </Box>
            }
            fullWidth
            multiple
            aria-label="Buckets"
            error={!!errors.buckets}
            options={bucketOptions}
            helperText={errors?.buckets?.message}
          />
        </div>

        <Box className="flex w-full flex-row justify-between rounded border-t p-4">
          <Button variant="outlined" color="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            startIcon={id ? <ArrowsClockwise /> : <PlusIcon />}
          >
            {id ? 'Update' : 'Create'}
          </Button>
        </Box>
      </Form>
    </FormProvider>
  );
}

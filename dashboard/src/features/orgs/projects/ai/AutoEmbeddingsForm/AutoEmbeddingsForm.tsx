import { yupResolver } from '@hookform/resolvers/yup';
import { PlusIcon, RefreshCwIcon } from 'lucide-react';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { FormInput } from '@/components/form/FormInput';
import { FormSelect } from '@/components/form/FormSelect';
import { FormTextarea } from '@/components/form/FormTextarea';
import { Button } from '@/components/ui/v3/button';
import { SelectItem } from '@/components/ui/v3/select';
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  useInsertGraphiteAutoEmbeddingsConfigurationMutation,
  useUpdateGraphiteAutoEmbeddingsConfigurationMutation,
} from '@/generated/graphite';
import { useTrackEvent } from '@/hooks/useTrackEvent';
import type { DialogFormProps } from '@/types/common';

const AUTO_EMBEDDINGS_MODELS = [
  'text-embedding-ada-002',
  'text-embedding-3-small',
  'text-embedding-3-large',
];

export const validationSchema = Yup.object({
  name: Yup.string().required('The name field is required.'),
  model: Yup.string().oneOf(AUTO_EMBEDDINGS_MODELS),
  schemaName: Yup.string().required('The schema field is required'),
  tableName: Yup.string().required('The table field is required'),
  columnName: Yup.string().required('The column field is required'),
  query: Yup.string(),
  mutation: Yup.string(),
});

export type AutoEmbeddingsFormValues = Yup.InferType<typeof validationSchema>;

export type AutoEmbeddingsInitialData = AutoEmbeddingsFormValues & {
  model: string;
};

export interface AutoEmbeddingsFormProps extends DialogFormProps {
  /**
   * To use in conjunction with initialData to allow for updating the autoEmbeddingsConfiguration
   */
  autoEmbeddingsId?: string;

  /**
   * if there is initialData then it's an update operation
   */
  initialData?: AutoEmbeddingsInitialData;

  /**
   * Function to be called when the operation is cancelled.
   */
  onCancel?: () => Promise<unknown>;
  /**
   * Function to be called when the submit is successful.
   */
  onSubmit?: () => Promise<unknown>;
}

export default function AutoEmbeddingsForm({
  autoEmbeddingsId,
  initialData,
  onSubmit,
  onCancel,
  location,
}: AutoEmbeddingsFormProps) {
  const { onDirtyStateChange } = useDialog();
  const track = useTrackEvent();

  const remoteProjectGQLClient = useRemoteApplicationGQLClient();

  const [insertGraphiteAutoEmbeddingsConfiguration] =
    useInsertGraphiteAutoEmbeddingsConfigurationMutation({
      client: remoteProjectGQLClient,
    });

  const [updateGraphiteAutoEmbeddingsConfiguration] =
    useUpdateGraphiteAutoEmbeddingsConfigurationMutation({
      client: remoteProjectGQLClient,
    });

  const form = useForm<AutoEmbeddingsFormValues>({
    defaultValues: {
      ...initialData,
      model: initialData?.model ?? 'text-embedding-ada-002',
    },
    reValidateMode: 'onSubmit',
    resolver: yupResolver(validationSchema),
  });

  const {
    formState: { isSubmitting, dirtyFields },
  } = form;

  const isDirty = Object.keys(dirtyFields).length > 0;

  useEffect(() => {
    onDirtyStateChange(isDirty, location);
  }, [isDirty, location, onDirtyStateChange]);

  const createOrUpdateAutoEmbeddings = async (
    values: AutoEmbeddingsFormValues,
  ) => {
    // If the autoEmbeddingsId is set then we do an update
    if (autoEmbeddingsId) {
      await updateGraphiteAutoEmbeddingsConfiguration({
        variables: {
          id: autoEmbeddingsId,
          ...values,
        },
      });

      return;
    }

    await insertGraphiteAutoEmbeddingsConfiguration({
      variables: {
        ...values,
      },
    });
    track('AI Embedding Configured');
  };

  const handleSubmit = async (values: AutoEmbeddingsFormValues) => {
    await execPromiseWithErrorToast(
      async () => {
        await createOrUpdateAutoEmbeddings(values);
        onSubmit?.();
      },
      {
        loadingMessage: 'Configuring the Auto-Embeddings...',
        successMessage: 'The Auto-Embeddings has been configured successfully.',
        errorMessage:
          'An error occurred while configuring the Auto-Embeddings. Please try again.',
      },
    );
  };

  return (
    <FormProvider {...form}>
      <Form
        onSubmit={handleSubmit}
        className="flex h-full flex-col gap-4 overflow-hidden"
      >
        <div className="flex flex-1 flex-col space-y-6 overflow-auto px-6">
          <FormInput
            control={form.control}
            name="name"
            label="Name"
            placeholder=""
            autoComplete="off"
            autoFocus
          />

          <FormSelect
            control={form.control}
            name="model"
            label="Model"
            contentClassName="z-[10000]"
          >
            {AUTO_EMBEDDINGS_MODELS.map((model) => (
              <SelectItem key={model} value={model}>
                {model}
              </SelectItem>
            ))}
          </FormSelect>

          <FormInput
            control={form.control}
            name="schemaName"
            label="Table schema"
            placeholder=""
            autoComplete="off"
          />

          <FormInput
            control={form.control}
            name="tableName"
            label="Table"
            placeholder=""
            autoComplete="off"
          />

          <FormInput
            control={form.control}
            name="columnName"
            label="Column"
            placeholder=""
            autoComplete="off"
          />

          <FormTextarea
            control={form.control}
            name="query"
            label="Query"
            placeholder=""
            autoComplete="off"
            className="min-h-32 resize-y"
          />

          <FormTextarea
            control={form.control}
            name="mutation"
            label="Mutation"
            placeholder=""
            autoComplete="off"
            className="min-h-32 resize-y"
          />
        </div>

        <div className="flex w-full flex-row justify-between rounded border-t px-6 py-4">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {autoEmbeddingsId ? (
              <RefreshCwIcon className="mr-2 h-4 w-4" />
            ) : (
              <PlusIcon className="mr-2 h-4 w-4" />
            )}
            {autoEmbeddingsId ? 'Update' : 'Create'}
          </Button>
        </div>
      </Form>
    </FormProvider>
  );
}

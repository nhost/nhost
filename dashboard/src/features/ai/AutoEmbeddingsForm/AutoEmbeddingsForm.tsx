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
import { useAdminApolloClient } from '@/features/projects/common/hooks/useAdminApolloClient';
import type { DialogFormProps } from '@/types/common';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import {
  useInsertGraphiteAutoEmbeddingsConfigurationMutation,
  useUpdateGraphiteAutoEmbeddingsConfigurationMutation,
} from '@/utils/__generated__/graphite.graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

const AUTO_EMBEDDINGS_MODELS = [
  'text-embedding-ada-002',
  'text-embedding-3-small',
  'text-embedding-3-large',
];

export const validationSchema = Yup.object({
  name: Yup.string().required('The name field is required.'),
  model: Yup.object({
    label: Yup.string().required(),
    value: Yup.string().required(),
  }),
  schemaName: Yup.string().required('The schema field is required'),
  tableName: Yup.string().required('The table field is required'),
  columnName: Yup.string().required('The column field is required'),
  query: Yup.string(),
  mutation: Yup.string(),
});

export type AutoEmbeddingsFormValues = Yup.InferType<typeof validationSchema>;

export interface AutoEmbeddingsFormProps extends DialogFormProps {
  /**
   * To use in conjunction with initialData to allow for updating the autoEmbeddingsConfiguration
   */
  autoEmbeddingsId?: string;

  /**
   * if there is initialData then it's an update operation
   */
  initialData?: AutoEmbeddingsFormValues & { model: string };

  /**
   * Function to be called when the operation is cancelled.
   */
  onCancel?: VoidFunction;
  /**
   * Function to be called when the submit is successful.
   */
  onSubmit?: VoidFunction | ((args?: any) => Promise<any>);
}

export default function AutoEmbeddingsForm({
  autoEmbeddingsId,
  initialData,
  onSubmit,
  onCancel,
  location,
}: AutoEmbeddingsFormProps) {
  const { onDirtyStateChange } = useDialog();

  const { adminClient } = useAdminApolloClient();

  const [insertGraphiteAutoEmbeddingsConfiguration] =
    useInsertGraphiteAutoEmbeddingsConfigurationMutation({
      client: adminClient,
    });

  const [updateGraphiteAutoEmbeddingsConfiguration] =
    useUpdateGraphiteAutoEmbeddingsConfigurationMutation({
      client: adminClient,
    });

  const form = useForm<AutoEmbeddingsFormValues>({
    defaultValues: {
      ...initialData,
      model: {
        label: initialData?.model ?? 'text-embedding-ada-002',
        value: initialData?.model ?? 'text-embedding-ada-002',
      },
    },
    reValidateMode: 'onSubmit',
    resolver: yupResolver(validationSchema),
  });

  const {
    register,
    formState: { errors, isSubmitting, dirtyFields },
  } = form;

  const isDirty = Object.keys(dirtyFields).length > 0;

  const availableModels = AUTO_EMBEDDINGS_MODELS.map((model) => ({
    label: model,
    value: model,
  }));

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
          model: values.model.value,
        },
      });

      return;
    }

    await insertGraphiteAutoEmbeddingsConfiguration({
      variables: {
        ...values,
        model: values.model.value,
      },
    });
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
        className="flex flex-col h-full gap-4 overflow-hidden"
      >
        <div className="flex flex-col flex-1 px-6 space-y-6 overflow-auto">
          <Input
            {...register('name')}
            id="name"
            label={
              <Box className="flex flex-row items-center space-x-2">
                <Text>Name</Text>
                <Tooltip title="Name of the Auto-Embeddings">
                  <InfoIcon
                    aria-label="Info"
                    className="w-4 h-4"
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
            id="model"
            name="model"
            label={
              <Box className="flex flex-row items-center space-x-2">
                <Text>Model</Text>
                <Tooltip title="Auto-Embeddings Model">
                  <InfoIcon
                    aria-label="Info"
                    className="w-4 h-4"
                    color="primary"
                  />
                </Tooltip>
              </Box>
            }
            freeSolo
            getOptionLabel={(option) => {
              if (typeof option === 'string') {
                return option || '';
              }

              return option.value;
            }}
            isOptionEqualToValue={() => false}
            filterOptions={(options, { inputValue }) => {
              const inputValueLower = inputValue.toLowerCase();
              const matched = [];
              const otherOptions = [];

              options.forEach((option) => {
                const optionLabelLower = option.label.toLowerCase();

                if (optionLabelLower.startsWith(inputValueLower)) {
                  matched.push(option);
                } else {
                  otherOptions.push(option);
                }
              });

              const result = [...matched, ...otherOptions];

              return result;
            }}
            fullWidth
            className="lg:col-span-2"
            options={availableModels}
            defaultValue={{
              label: 'text-embedding-ada-002',
              value: 'text-embedding-ada-002',
            }}
            error={!!errors?.model?.value?.message}
            helperText={errors?.model?.value?.message}
          />

          <Input
            {...register('schemaName')}
            id="schemaName"
            label={
              <Box className="flex flex-row items-center space-x-2">
                <Text>Schema</Text>
                <Tooltip title={<span>Schema where the table belongs to</span>}>
                  <InfoIcon
                    aria-label="Info"
                    className="w-4 h-4"
                    color="primary"
                  />
                </Tooltip>
              </Box>
            }
            placeholder=""
            hideEmptyHelperText
            error={!!errors.schemaName}
            helperText={errors?.schemaName?.message}
            fullWidth
            autoComplete="off"
          />
          <Input
            {...register('tableName')}
            id="tableName"
            label={
              <Box className="flex flex-row items-center space-x-2">
                <Text>Table</Text>
                <Tooltip title="Table Name">
                  <InfoIcon
                    aria-label="Info"
                    className="w-4 h-4"
                    color="primary"
                  />
                </Tooltip>
              </Box>
            }
            placeholder=""
            hideEmptyHelperText
            error={!!errors.tableName}
            helperText={errors?.tableName?.message}
            fullWidth
            autoComplete="off"
          />
          <Input
            {...register('columnName')}
            id="columnName"
            label={
              <Box className="flex flex-row items-center space-x-2">
                <Text>Column</Text>
                <Tooltip title="Column name">
                  <InfoIcon
                    aria-label="Info"
                    className="w-4 h-4"
                    color="primary"
                  />
                </Tooltip>
              </Box>
            }
            placeholder=""
            hideEmptyHelperText
            error={!!errors.columnName}
            helperText={errors?.columnName?.message}
            fullWidth
            autoComplete="off"
          />
          <Input
            {...register('query')}
            id="query"
            label={
              <Box className="flex flex-row items-center space-x-2">
                <Text>Query</Text>
                <Tooltip title="Query">
                  <InfoIcon
                    aria-label="Info"
                    className="w-4 h-4"
                    color="primary"
                  />
                </Tooltip>
              </Box>
            }
            placeholder=""
            hideEmptyHelperText
            error={!!errors.query}
            helperText={errors?.query?.message}
            fullWidth
            autoComplete="off"
            multiline
            rows={6}
          />
          <Input
            {...register('mutation')}
            id="mutation"
            label={
              <Box className="flex flex-row items-center space-x-2">
                <Text>Mutation</Text>
                <Tooltip title="Mutation">
                  <InfoIcon
                    aria-label="Info"
                    className="w-4 h-4"
                    color="primary"
                  />
                </Tooltip>
              </Box>
            }
            placeholder=""
            hideEmptyHelperText
            error={!!errors.mutation}
            helperText={errors?.mutation?.message}
            fullWidth
            autoComplete="off"
            multiline
            rows={6}
          />
        </div>

        <Box className="flex flex-row justify-between w-full px-6 py-4 border-t rounded">
          <Button variant="outlined" color="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            startIcon={autoEmbeddingsId ? <ArrowsClockwise /> : <PlusIcon />}
          >
            {autoEmbeddingsId ? 'Update' : 'Create'}
          </Button>
        </Box>
      </Form>
    </FormProvider>
  );
}

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
import { GraphqlDataSourcesFormSection } from '@/features/ai/AssistantForm/components/GraphqlDataSourcesFormSection';
import { WebhooksDataSourcesFormSection } from '@/features/ai/AssistantForm/components/WebhooksDataSourcesFormSection';
import { useAdminApolloClient } from '@/features/projects/common/hooks/useAdminApolloClient';
// import { useRemoteApplicationGQLClient } from '@/hooks/useRemoteApplicationGQLClient';
import type { DialogFormProps } from '@/types/common';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { removeTypename, type DeepRequired } from '@/utils/helpers';
import {
  // useGetGraphiteFileStoresQuery,
  useInsertAssistantMutation,
  useUpdateAssistantMutation,
} from '@/utils/__generated__/graphite.graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { type GraphiteFileStore } from 'pages/[workspaceSlug]/[appSlug]/ai/file-stores';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

export const validationSchema = Yup.object({
  name: Yup.string().required('The name is required.'),
  description: Yup.string(),
  instructions: Yup.string().required('The instructions are required'),
  model: Yup.string().required('The model is required'),
  fileStores: Yup.array()
    .of(
      Yup.object({
        label: Yup.string(),
        value: Yup.string(),
        id: Yup.string(),
      }),
    )
    .label('File Stores'),
  graphql: Yup.array().of(
    Yup.object().shape({
      name: Yup.string().required(),
      description: Yup.string().required(),
      query: Yup.string().required(),
      arguments: Yup.array().of(
        Yup.object().shape({
          name: Yup.string().required(),
          description: Yup.string().required(),
          type: Yup.string().required(),
          required: Yup.bool().required(),
        }),
      ),
    }),
  ),
  webhooks: Yup.array().of(
    Yup.object().shape({
      name: Yup.string().required(),
      description: Yup.string().required(),
      URL: Yup.string().required(),
      arguments: Yup.array().of(
        Yup.object().shape({
          name: Yup.string().required(),
          description: Yup.string().required(),
          type: Yup.string().required(),
          required: Yup.bool().required(),
        }),
      ),
    }),
  ),
});

export type AssistantFormValues = Yup.InferType<typeof validationSchema>;

export interface AssistantFormProps extends DialogFormProps {
  /**
   * To use in conjunction with initialData to allow for updating the Assistant Configuration
   */
  assistantId?: string;

  /**
   * if there is initialData then it's an update operation
   */
  initialData?: AssistantFormValues;
  fileStores?: GraphiteFileStore[];

  /**
   * Function to be called when the operation is cancelled.
   */
  onCancel?: VoidFunction;
  /**
   * Function to be called when the submit is successful.
   */
  onSubmit?: VoidFunction | ((args?: any) => Promise<any>);
}

export default function AssistantForm({
  assistantId,
  initialData,
  fileStores,
  onSubmit,
  onCancel,
  location,
}: AssistantFormProps) {
  const { onDirtyStateChange } = useDialog();

  const { adminClient } = useAdminApolloClient();

  const [insertAssistantMutation] = useInsertAssistantMutation({
    client: adminClient,
  });

  const [updateAssistantMutation] = useUpdateAssistantMutation({
    client: adminClient,
  });

  const fileStoresOptions = fileStores
    ? fileStores.map((fileStore: GraphiteFileStore) => ({
        label: fileStore.name,
        value: fileStore.name,
        id: fileStore.id,
      }))
    : [];

  const assistantFileStores = initialData?.fileStores
    ? fileStores?.filter((fileStore: GraphiteFileStore) =>
        initialData.fileStores.includes(fileStore.id),
      )
    : [];

  const formDefaultValues = { ...initialData, fileStores: [] };
  formDefaultValues.fileStores = assistantFileStores
    ? assistantFileStores.map((b) => ({
        label: b.name,
        value: b.name,
        id: b.id,
      }))
    : [];

  const form = useForm<AssistantFormValues>({
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

  const createOrUpdateAssistant = async (
    values: DeepRequired<AssistantFormValues> & { assistantID: string },
  ) => {
    // remove any __typename from the form values
    const payload = removeTypename(values);

    if (values.webhooks?.length === 0) {
      delete payload.webhooks;
    }

    if (values.graphql?.length === 0) {
      delete payload.graphql;
    }

    if (values.fileStores?.length === 0) {
      delete payload.fileStores;
    } else {
      payload.fileStores = values.fileStores.map((fileStore) => fileStore.id);
    }

    // remove assistantId because the update mutation fails otherwise
    delete payload.assistantID;

    // If the assistantId is set then we do an update
    if (assistantId) {
      await updateAssistantMutation({
        variables: {
          id: assistantId,
          data: payload,
        },
      });

      return;
    }

    await insertAssistantMutation({
      variables: {
        data: {
          ...values,
          fileStores: values.fileStores.map((fileStore) => fileStore.id),
        },
      },
    });
  };

  const handleSubmit = async (
    values: DeepRequired<AssistantFormValues> & { assistantID: string },
  ) => {
    await execPromiseWithErrorToast(
      async () => {
        await createOrUpdateAssistant(values);
        onSubmit?.();
      },
      {
        loadingMessage: 'Configuring the Assistant...',
        successMessage: 'The Assistant has been configured successfully.',
        errorMessage:
          'An error occurred while configuring the Assistant. Please try again.',
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
                <Tooltip title="Name of the assistant">
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

          <Input
            {...register('description')}
            id="description"
            label={
              <Box className="flex flex-row items-center space-x-2">
                <Text>Description</Text>
                <Tooltip title={<span>Description of the assistant</span>}>
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
            error={!!errors.description}
            helperText={errors?.description?.message}
            fullWidth
            autoComplete="off"
            multiline
            inputProps={{
              className: 'resize-y min-h-[22px]',
            }}
          />

          <Input
            {...register('instructions')}
            id="instructions"
            label={
              <Box className="flex flex-row items-center space-x-2">
                <Text>Instructions</Text>
                <Tooltip title="Instructions for the assistant. This is used to instruct the AI assistant on how to behave and respond to the user">
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
            error={!!errors.instructions}
            helperText={errors?.instructions?.message}
            fullWidth
            autoComplete="off"
            multiline
            inputProps={{
              className: 'resize-y min-h-[22px]',
            }}
          />

          <Input
            {...register('model')}
            id="model"
            label={
              <Box className="flex flex-row items-center space-x-2">
                <Text>Model</Text>
                <Tooltip title="Model to use for the assistant.">
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
            error={!!errors.model}
            helperText={errors?.model?.message}
            fullWidth
            autoComplete="off"
            autoFocus
          />

          <ControlledAutocomplete
            id="fileStores"
            name="fileStores"
            label={
              <Box className="flex flex-row items-center space-x-2">
                <Text>File Stores</Text>
                <Tooltip title="File Stores this assistant will have access to.">
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
            aria-label="File Stores"
            options={fileStoresOptions}
            error={!!errors.fileStores}
            helperText={errors?.fileStores?.message}
          />

          <GraphqlDataSourcesFormSection />
          <WebhooksDataSourcesFormSection />
        </div>

        <Box className="flex w-full flex-row justify-between rounded border-t p-4">
          <Button variant="outlined" color="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            startIcon={assistantId ? <ArrowsClockwise /> : <PlusIcon />}
          >
            {assistantId ? 'Update' : 'Create'}
          </Button>
        </Box>
      </Form>
    </FormProvider>
  );
}

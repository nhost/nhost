import { useDialog } from '@/components/common/DialogProvider';
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
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { generateAppServiceUrl } from '@/features/projects/common/utils/generateAppServiceUrl';
import type { DialogFormProps } from '@/types/common';
import { getToastStyleProps } from '@/utils/constants/settings';
import { getHasuraAdminSecret } from '@/utils/env';
import { removeTypename, type DeepRequired } from '@/utils/helpers';
import {
  useInsertAssistantMutation,
  useUpdateAssistantMutation,
} from '@/utils/__generated__/graphite.graphql';
import {
  ApolloClient,
  HttpLink,
  InMemoryCache,
  type ApolloError,
} from '@apollo/client';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import * as Yup from 'yup';

export const validationSchema = Yup.object({
  name: Yup.string().required('The name is required.'),
  description: Yup.string(),
  instructions: Yup.string().required('The instructions are required'),
  model: Yup.string().required('The model is required'),
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
   * To use in conjunction with initialData to allow for updating the autoEmbeddingsConfiguration
   */
  assistantId?: string;

  /**
   * if there is initialData then it's an update operation
   */
  initialData?: AssistantFormValues;

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
  onSubmit,
  onCancel,
  location,
}: AssistantFormProps) {
  const { onDirtyStateChange } = useDialog();

  const { currentProject } = useCurrentWorkspaceAndProject();

  const serviceUrl = generateAppServiceUrl(
    currentProject?.subdomain,
    currentProject?.region,
    'graphql',
  );

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({
      uri: serviceUrl,
      headers: {
        'x-hasura-admin-secret':
          process.env.NEXT_PUBLIC_ENV === 'dev'
            ? getHasuraAdminSecret()
            : currentProject?.config?.hasura.adminSecret,
      },
    }),
  });

  const [insertAssistantMutation] = useInsertAssistantMutation({
    client,
  });

  const [updateAssistantMutation] = useUpdateAssistantMutation({ client });

  const form = useForm<AssistantFormValues>({
    defaultValues: initialData,
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

  const createOrUpdateAutoEmbeddings = async (
    values: DeepRequired<AssistantFormValues> & { assistantID: string },
  ) => {
    // remove any __typename from the form values
    const payload = removeTypename(values);

    if (values.webhooks.length === 0) {
      delete payload.webhooks;
    }

    if (values.graphql.length === 0) {
      delete payload.graphql;
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
        },
      },
    });
  };

  const handleSubmit = async (
    values: DeepRequired<AssistantFormValues> & { assistantID: string },
  ) => {
    try {
      await toast.promise(
        createOrUpdateAutoEmbeddings(values),
        {
          loading: 'Configuring the Assistant...',
          success: `The Assistant has been configured successfully.`,
          error: (arg: ApolloError) => {
            // we need to get the internal error message from the GraphQL error
            const { internal } = arg.graphQLErrors[0]?.extensions || {};
            const { message } = (internal as Record<string, any>)?.error || {};

            // we use the default Apollo error message if we can't find the
            // internal error message
            return (
              message ||
              arg.message ||
              'An error occurred while configuring the Assistant. Please try again.'
            );
          },
        },
        getToastStyleProps(),
      );

      onSubmit?.();
    } catch {
      // Note: The toast will handle the error.
    }
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

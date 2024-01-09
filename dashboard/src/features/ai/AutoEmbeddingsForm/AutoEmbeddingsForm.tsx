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
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { generateAppServiceUrl } from '@/features/projects/common/utils/generateAppServiceUrl';
import type { DialogFormProps } from '@/types/common';
import { getToastStyleProps } from '@/utils/constants/settings';
import { getHasuraAdminSecret } from '@/utils/env';
import {
  useInsertGraphiteAutoEmbeddingsConfigurationMutation,
  useUpdateGraphiteAutoEmbeddingsConfigurationMutation,
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
  schemaName: Yup.string().required('The schema is required'),
  tableName: Yup.string().required('The table is required'),
  columnName: Yup.string().required('The column is required'),
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
  initialData?: AutoEmbeddingsFormValues;

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

  const [insertGraphiteAutoEmbeddingsConfiguration] =
    useInsertGraphiteAutoEmbeddingsConfigurationMutation({
      client,
    });

  const [updateGraphiteAutoEmbeddingsConfiguration] =
    useUpdateGraphiteAutoEmbeddingsConfigurationMutation({ client });

  const form = useForm<AutoEmbeddingsFormValues>({
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
      variables: values,
    });
  };

  const handleSubmit = async (values: AutoEmbeddingsFormValues) => {
    try {
      await toast.promise(
        createOrUpdateAutoEmbeddings(values),
        {
          loading: 'Configuring the Auto-Embeddings...',
          success: `The Auto-Embeddings has been configured successfully.`,
          error: (arg: ApolloError) => {
            // we need to get the internal error message from the GraphQL error
            const { internal } = arg.graphQLErrors[0]?.extensions || {};
            const { message } = (internal as Record<string, any>)?.error || {};

            // we use the default Apollo error message if we can't find the
            // internal error message
            return (
              message ||
              arg.message ||
              'An error occurred while configuring the Auto-Embeddings. Please try again.'
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
        className="flex h-full flex-col gap-4 overflow-hidden"
      >
        <div className="flex flex-1 flex-col space-y-6 overflow-auto px-6">
          <Input
            {...register('name')}
            id="name"
            label={
              <Box className="flex flex-row items-center space-x-2">
                <Text>Name</Text>
                <Tooltip title="Name of the Auto-Embeddings">
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
            {...register('schemaName')}
            id="schemaName"
            label={
              <Box className="flex flex-row items-center space-x-2">
                <Text>Schema</Text>
                <Tooltip title={<span>Schema where the table belongs to</span>}>
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
                    className="h-4 w-4"
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
                    className="h-4 w-4"
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
                    className="h-4 w-4"
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
                    className="h-4 w-4"
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

        <Box className="flex w-full flex-row justify-between rounded border-t px-6 py-4">
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

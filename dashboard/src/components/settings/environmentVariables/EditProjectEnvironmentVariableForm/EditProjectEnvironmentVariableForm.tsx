import type {
  BaseProjectEnvironmentVariableFormProps,
  BaseProjectEnvironmentVariableFormValues,
} from '@/components/settings/environmentVariables/BaseProjectEnvironmentVariableForm';
import BaseProjectEnvironmentVariableForm, {
  baseProjectEnvironmentVariableFormValidationSchema,
} from '@/components/settings/environmentVariables/BaseProjectEnvironmentVariableForm';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import type { EnvironmentVariable } from '@/types/application';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import { toastStyleProps } from '@/utils/settings/settingsConstants';
import {
  useGetEnvironmentVariablesQuery,
  useUpdateEnvironmentVariableMutation,
} from '@/utils/__generated__/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

export interface EditProjectEnvironmentVariableFormProps
  extends Pick<BaseProjectEnvironmentVariableFormProps, 'onCancel'> {
  /**
   * The environment variable to edit.
   */
  originalEnvironmentVariable: EnvironmentVariable;
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: () => Promise<void>;
}

export default function EditProjectEnvironmentVariableForm({
  originalEnvironmentVariable,
  onSubmit,
  ...props
}: EditProjectEnvironmentVariableFormProps) {
  const form = useForm<BaseProjectEnvironmentVariableFormValues>({
    defaultValues: {
      id: originalEnvironmentVariable.id || '',
      name: originalEnvironmentVariable.name || '',
      devValue: originalEnvironmentVariable.devValue || '',
      prodValue: originalEnvironmentVariable.prodValue || '',
    },
    reValidateMode: 'onSubmit',
    resolver: yupResolver(baseProjectEnvironmentVariableFormValidationSchema),
  });

  const { currentApplication } = useCurrentWorkspaceAndApplication();

  const { data, loading, error } = useGetEnvironmentVariablesQuery({
    variables: {
      id: currentApplication?.id,
    },
    fetchPolicy: 'cache-only',
  });

  const [updateEnvironmentVariable] = useUpdateEnvironmentVariableMutation({
    refetchQueries: ['getEnvironmentVariables'],
  });

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading environment variables..."
      />
    );
  }

  if (error) {
    throw error;
  }

  const { setError } = form;

  async function handleSubmit({
    id,
    name,
    prodValue,
    devValue,
  }: BaseProjectEnvironmentVariableFormValues) {
    if (
      data?.environmentVariables?.some(
        (environmentVariable) =>
          environmentVariable.name === name &&
          environmentVariable.name !== originalEnvironmentVariable.name,
      )
    ) {
      setError('name', {
        message: 'This environment variable already exists.',
      });

      return;
    }

    const insertEnvironmentVariablePromise = updateEnvironmentVariable({
      variables: {
        id,
        environmentVariable: {
          prodValue,
          devValue,
        },
      },
    });

    await toast.promise(
      insertEnvironmentVariablePromise,
      {
        loading: 'Updating environment variable...',
        success: 'Environment variable has been updated successfully.',
        error: 'An error occurred while updating the environment variable.',
      },
      toastStyleProps,
    );

    onSubmit?.();
  }

  return (
    <FormProvider {...form}>
      <BaseProjectEnvironmentVariableForm onSubmit={handleSubmit} {...props} />
    </FormProvider>
  );
}

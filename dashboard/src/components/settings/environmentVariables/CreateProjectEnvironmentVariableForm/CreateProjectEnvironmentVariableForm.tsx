import type {
  BaseProjectEnvironmentVariableFormProps,
  BaseProjectEnvironmentVariableFormValues,
} from '@/components/settings/environmentVariables/BaseProjectEnvironmentVariableForm';
import BaseProjectEnvironmentVariableForm, {
  baseProjectEnvironmentVariableFormValidationSchema,
} from '@/components/settings/environmentVariables/BaseProjectEnvironmentVariableForm';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import { toastStyleProps } from '@/utils/settings/settingsConstants';
import {
  useGetEnvironmentVariablesQuery,
  useInsertEnvironmentVariablesMutation,
} from '@/utils/__generated__/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

export interface CreateProjectEnvironmentVariableFormProps
  extends Pick<BaseProjectEnvironmentVariableFormProps, 'onCancel'> {
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: () => Promise<void>;
}

export default function CreateProjectEnvironmentVariableForm({
  onSubmit,
  ...props
}: CreateProjectEnvironmentVariableFormProps) {
  const form = useForm<BaseProjectEnvironmentVariableFormValues>({
    defaultValues: {
      name: '',
      devValue: '',
      prodValue: '',
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

  const [insertEnvironmentVariables] = useInsertEnvironmentVariablesMutation({
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
    name,
    prodValue,
    devValue,
  }: BaseProjectEnvironmentVariableFormValues) {
    if (
      data?.environmentVariables?.some(
        (environmentVariable) => environmentVariable.name === name,
      )
    ) {
      setError('name', {
        message: 'This environment variable already exists.',
      });

      return;
    }

    const insertEnvironmentVariablePromise = insertEnvironmentVariables({
      variables: {
        environmentVariables: [
          { appId: currentApplication.id, name, prodValue, devValue },
        ],
      },
    });

    await toast.promise(
      insertEnvironmentVariablePromise,
      {
        loading: 'Creating environment variable...',
        success: 'Environment variable has been created successfully.',
        error: 'An error occurred while creating the environment variable.',
      },
      toastStyleProps,
    );

    onSubmit?.();
  }

  return (
    <FormProvider {...form}>
      <BaseProjectEnvironmentVariableForm
        submitButtonText="Create"
        onSubmit={handleSubmit}
        {...props}
      />
    </FormProvider>
  );
}

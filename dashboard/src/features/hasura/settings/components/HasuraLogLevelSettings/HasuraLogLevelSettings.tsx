import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { ControlledAutocomplete } from '@/components/form/ControlledAutocomplete';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { HighlightedText } from '@/components/presentational/HighlightedText';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import {
  GetHasuraSettingsDocument,
  useGetHasuraSettingsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { useLocalMimirClient } from '@/hooks/useLocalMimirClient';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  logLevel: Yup.object({
    label: Yup.string().required(),
    value: Yup.string().required(),
  })
    .label('Log level')
    .required(),
});

export type HasuraLogLevelFormValues = Yup.InferType<typeof validationSchema>;

const AVAILABLE_HASURA_LOG_LEVELS = ['debug', 'info', 'warn', 'error'];

export default function HasuraLogLevelSettings() {
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { maintenanceActive } = useUI();
  const { currentProject, refetch: refetchWorkspaceAndProject } =
    useCurrentWorkspaceAndProject();
  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetHasuraSettingsDocument],
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { data, loading, error } = useGetHasuraSettingsQuery({
    variables: { appId: currentProject?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { level } = data?.config?.hasura.logs || {};

  const form = useForm<HasuraLogLevelFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      logLevel: level
        ? {
            label: level,
            value: level,
          }
        : { label: 'warn', value: 'warn' },
    },
    resolver: yupResolver(validationSchema),
  });

  useEffect(() => {
    if (!loading && level) {
      form.reset({
        logLevel: {
          label: level,
          value: level,
        },
      });
    }
  }, [form, loading, level]);

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading log level settings..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const { formState } = form;
  const isDirty = Object.keys(formState.dirtyFields).length > 0;

  const availableLogLevels = AVAILABLE_HASURA_LOG_LEVELS.map((api) => ({
    label: api,
    value: api,
  }));

  async function handleSubmit(formValues: HasuraLogLevelFormValues) {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: currentProject.id,
        config: {
          hasura: {
            logs: {
              level: formValues.logLevel?.value || 'warn',
            },
          },
        },
      },
    });

    await execPromiseWithErrorToast(
      async () => {
        await updateConfigPromise;
        form.reset(formValues);
        await refetchWorkspaceAndProject();

        if (!isPlatform) {
          openDialog({
            title: 'Apply your changes',
            component: <ApplyLocalSettingsDialog />,
            props: {
              PaperProps: {
                className: 'max-w-2xl',
              },
            },
          });
        }
      },
      {
        loadingMessage: 'Log level is being updated...',
        successMessage: 'Log level has been updated successfully.',
        errorMessage: 'An error occurred while trying to update log level.',
      },
    );
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsContainer
          title="Log Level"
          description={
            <>
              Setting a log-level will print all logs of priority greater than
              the set level. The log-level hierarchy is:{' '}
              <HighlightedText>
                debug &rarr; info &rarr; warn &rarr; error
              </HighlightedText>
            </>
          }
          docsLink="https://hasura.io/docs/latest/deployment/logging/#logging-levels"
          docsTitle="Log Levels"
          slotProps={{
            submitButton: {
              disabled: !isDirty || maintenanceActive,
              loading: formState.isSubmitting,
            },
          }}
          className="grid grid-flow-row gap-x-4 gap-y-2 px-4 lg:grid-cols-5"
        >
          <ControlledAutocomplete
            id="logLevel"
            name="logLevel"
            fullWidth
            className="lg:col-span-2"
            aria-label="Hasura Log Level"
            options={availableLogLevels}
            error={!!formState.errors?.logLevel?.message}
            helperText={formState.errors?.logLevel?.message}
          />
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}

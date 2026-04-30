import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { Alert } from '@/components/ui/v2/Alert';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useUpdateApplicationMutation } from '@/utils/__generated__/graphql';

interface AutomaticDeploysFormValues {
  enabled: boolean;
}

export default function AutomaticDeploysSettings() {
  const { project, refetch } = useProject();
  const [updateApp] = useUpdateApplicationMutation();

  const form = useForm<AutomaticDeploysFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      enabled: project?.automaticDeploys ?? true,
    },
  });

  const { formState, reset } = form;

  useEffect(() => {
    if (project) {
      reset({ enabled: project.automaticDeploys ?? true });
    }
  }, [project?.automaticDeploys, reset, project]);

  const handleSubmit = async (values: AutomaticDeploysFormValues) => {
    const updateAppMutation = updateApp({
      variables: {
        appId: project?.id,
        app: {
          automaticDeploys: values.enabled,
        },
      },
    });

    await execPromiseWithErrorToast(
      async () => {
        await updateAppMutation;
        form.reset(values);
        await refetch();
      },
      {
        loadingMessage: 'Updating automatic deploys setting...',
        successMessage: `Automatic deploys ${values.enabled ? 'enabled' : 'disabled'}.`,
        errorMessage:
          'An error occurred while updating the automatic deploys setting.',
      },
    );
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsContainer
          title="Automatic Deploys"
          description="When enabled, commits pushed to the deployment branch will automatically trigger a deployment. When disabled, deployments must be triggered manually via the CLI or GitHub Actions."
          docsLink="https://docs.nhost.io/platform/cloud/deployments"
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty,
              loading: formState.isSubmitting,
            },
          }}
          switchId="enabled"
          showSwitch
          className="hidden"
        >
          {!project?.githubRepository && (
            <Alert className="col-span-5 w-full text-left">
              To configure automatic deploys, you first need to connect your
              project to a GitHub repository.
            </Alert>
          )}
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}

import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Form } from '@/components/form/Form';
import {
  SettingsCard,
  SettingsCardFooter,
  SettingsCardHeader,
  SettingsDocsLink,
} from '@/components/layout/SettingsCard';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import { FormField } from '@/components/ui/v3/form';
import { Switch } from '@/components/ui/v3/switch';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useUpdateApplicationMutation } from '@/generated/graphql';

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
        <SettingsCard>
          <SettingsCardHeader
            title="Automatic Deploys"
            description="When enabled, commits pushed to the deployment branch will automatically trigger a deployment. When disabled, deployments must be triggered manually via the CLI or GitHub Actions."
            control={
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="Toggle Automatic Deploys"
                  />
                )}
              />
            }
          />

          <SettingsCardFooter>
            <SettingsDocsLink
              href="https://docs.nhost.io/platform/cloud/deployments"
              title="Automatic Deploys"
            />

            <ButtonWithLoading
              type="submit"
              disabled={!formState.isDirty}
              loading={formState.isSubmitting}
              className="w-full sm:w-auto"
            >
              Save
            </ButtonWithLoading>
          </SettingsCardFooter>
        </SettingsCard>
      </Form>
    </FormProvider>
  );
}

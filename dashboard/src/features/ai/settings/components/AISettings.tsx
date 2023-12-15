import { useUI } from '@/components/common/UIProvider';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { Input } from '@/components/ui/v2/Input';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { ComputeFormSection } from '@/features/services/components/ServiceForm/components/ComputeFormSection';
import { useUpdateConfigMutation } from '@/generated/graphql';
import { getToastStyleProps } from '@/utils/constants/settings';
import { getServerError } from '@/utils/getServerError';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';

export interface AISettingsFormValues {
  /**
   * The git branch to deploy from.
   */
  apiKey: string;
  compute: {
    cpu: 62;
    memory: 128;
  };
}

export default function AISettings() {
  const { maintenanceActive } = useUI();
  const [updateConfig] = useUpdateConfigMutation();
  const { currentProject } = useCurrentWorkspaceAndProject();

  const form = useForm<AISettingsFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      apiKey: currentProject?.config?.ai?.openai?.apiKey,
      compute: currentProject?.config?.ai?.resources?.compute || {
        cpu: 62,
        memory: 128,
      },
    },
  });

  const { register, formState } = form;

  async function handleSubmit(formValues: AISettingsFormValues) {
    try {
      await toast.promise(
        updateConfig({
          variables: {
            appId: currentProject.id,
            config: {
              ai: {
                openai: {
                  apiKey: formValues.apiKey,
                },
                resources: {
                  compute: formValues.compute,
                },
              },
            },
          },
        }),
        {
          loading: `AI settings are being updated...`,
          success: `AI settings has been updated successfully.`,
          error: getServerError(
            `An error occurred while trying to update the AI settings!`,
          ),
        },
        getToastStyleProps(),
      );

      form.reset(formValues);
    } catch {
      // Note: The toast will handle the error.
    }
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsContainer
          title="AI Settings"
          description="This will power the Auto-Embeddings and Assistants"
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty || maintenanceActive,
              loading: formState.isSubmitting,
            },
          }}
          // TODO update with docs link once they're out
          // docsLink="https://docs.nhost.io/platform/github-integration#deployment-branch"
          className="flex flex-col"
        >
          <Input
            {...register('apiKey')}
            name="apiKey"
            placeholder="Api Key"
            id="apiKey"
            className="col-span-3"
            fullWidth
            hideEmptyHelperText
          />

          <ComputeFormSection />
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}

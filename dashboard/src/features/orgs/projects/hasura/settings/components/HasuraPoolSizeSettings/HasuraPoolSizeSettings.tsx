import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { FormInput } from '@/components/form/FormInput';
import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardFooter,
  SettingsCardHeader,
  SettingsDocsLink,
} from '@/components/layout/SettingsCard';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  useGetHasuraSettingsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';

const validationSchema = Yup.object({
  httpPoolSize: Yup.number()
    .label('HTTP Pool Size')
    .min(1)
    .max(100)
    .typeError('HTTP Pool Size must be a number')
    .required(),
});

export type HasuraPoolSizeFormValues = Yup.InferType<typeof validationSchema>;

export default function HasuraPoolSizeSettings() {
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { project, refetch: refetchProject } = useProject();

  const [updateConfig] = useUpdateConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { data, error } = useGetHasuraSettingsQuery({
    variables: { appId: project?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { httpPoolSize } = data?.config?.hasura.events || {};

  const form = useForm<HasuraPoolSizeFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: { httpPoolSize: httpPoolSize || 100 },
    resolver: yupResolver(validationSchema),
  });

  if (error) {
    throw error;
  }

  const { formState } = form;
  const isDirty = Object.keys(formState.dirtyFields).length > 0;

  async function handleSubmit(formValues: HasuraPoolSizeFormValues) {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project?.id,
        config: {
          hasura: {
            events: {
              httpPoolSize: formValues.httpPoolSize,
            },
          },
        },
      },
    });

    await execPromiseWithErrorToast(
      async () => {
        await updateConfigPromise;
        form.reset(formValues);
        await refetchProject();

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
        loadingMessage: 'Pool size is being updated...',
        successMessage: 'Pool size has been updated successfully.',
        errorMessage: 'An error occurred while trying to update the pool size.',
      },
    );
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsCard>
          <SettingsCardHeader
            title="HTTP Pool Size"
            description="Set the maximum number of concurrent HTTP workers for event delivery."
          />

          <SettingsCardContent className="gap-x-4 gap-y-2 lg:grid-cols-5">
            <FormInput
              control={form.control}
              name="httpPoolSize"
              type="number"
              label="HTTP Pool Size"
              containerClassName="lg:col-span-2"
            />
          </SettingsCardContent>

          <SettingsCardFooter>
            <SettingsDocsLink
              href="https://hasura.io/docs/latest/deployment/graphql-engine-flags/reference/#events-http-pool-size"
              title="HTTP Pool Size"
            />

            <ButtonWithLoading
              type="submit"
              disabled={!isDirty}
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

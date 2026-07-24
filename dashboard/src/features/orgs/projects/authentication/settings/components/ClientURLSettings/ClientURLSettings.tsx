import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect } from 'react';
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
  useGetAuthenticationSettingsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';

const validationSchema = Yup.object({
  clientUrl: Yup.string().label('Client URL'),
});

export type ClientURLFormValues = Yup.InferType<typeof validationSchema>;

export default function ClientURLSettings() {
  const { project } = useProject();
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();

  const [updateConfig] = useUpdateConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { data, loading, error } = useGetAuthenticationSettingsQuery({
    variables: { appId: project?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { clientUrl, allowedUrls } = data?.config?.auth?.redirections || {};

  const form = useForm<ClientURLFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      clientUrl,
    },
    resolver: yupResolver(validationSchema),
  });

  useEffect(() => {
    if (!loading && clientUrl) {
      form.reset({ clientUrl });
    }
  }, [loading, clientUrl, form]);

  if (error) {
    throw error;
  }

  const { formState } = form;

  const handleClientURLChange = async (values: ClientURLFormValues) => {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project!.id,
        config: {
          auth: {
            redirections: {
              ...values,
              allowedUrls,
            },
          },
        },
      },
    });

    await execPromiseWithErrorToast(
      async () => {
        await updateConfigPromise;
        form.reset(values);

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
        loadingMessage: 'Client URL is being updated...',
        successMessage: 'Client URL has been updated successfully.',
        errorMessage:
          "An error occurred while trying to update the project's Client URL.",
      },
    );
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleClientURLChange}>
        <SettingsCard>
          <SettingsCardHeader
            title="Client URL"
            description="This should be the URL of your frontend app where users are redirected after authenticating."
          />

          <SettingsCardContent className="lg:grid-cols-5">
            <FormInput
              control={form.control}
              name="clientUrl"
              placeholder="http://localhost:3000"
              containerClassName="col-span-2"
              aria-label="Client URL"
            />
          </SettingsCardContent>

          <SettingsCardFooter>
            <SettingsDocsLink
              href="https://docs.nhost.io/products/auth/client_and_redirect_urls#client-url"
              title="Client URL"
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

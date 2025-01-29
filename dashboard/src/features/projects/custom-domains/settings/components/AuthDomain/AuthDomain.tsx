import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Input } from '@/components/ui/v2/Input';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { VerifyDomain } from '@/features/projects/custom-domains/settings/components/VerifyDomain';
import {
  useGetAuthenticationSettingsQuery,
  useUpdateConfigMutation,
  type ConfigIngressUpdateInput,
} from '@/generated/graphql';
import { useLocalMimirClient } from '@/hooks/useLocalMimirClient';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  auth_fqdn: Yup.string(),
});

export type AuthDomainFormValues = Yup.InferType<typeof validationSchema>;

export default function AuthDomain() {
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const { maintenanceActive } = useUI();
  const localMimirClient = useLocalMimirClient();
  const [isVerified, setIsVerified] = useState(false);

  const { currentProject, refetch: refetchWorkspaceAndProject } =
    useCurrentWorkspaceAndProject();

  const [updateConfig] = useUpdateConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const form = useForm<Yup.InferType<typeof validationSchema>>({
    reValidateMode: 'onSubmit',
    defaultValues: { auth_fqdn: null },
    resolver: yupResolver(validationSchema),
  });

  const { data, loading, error } = useGetAuthenticationSettingsQuery({
    variables: {
      appId: currentProject.id,
    },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { networking } = data?.config?.auth?.resources || {};
  const initialValue = networking?.ingresses?.[0]?.fqdn?.[0];

  useEffect(() => {
    if (!loading && data) {
      form.reset({ auth_fqdn: initialValue });
    }
  }, [data, loading, form, initialValue]);

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading Auth Domain Settings..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const { formState, register, watch } = form;
  const isDirty = Object.keys(formState.dirtyFields).length > 0;

  const auth_fqdn = watch('auth_fqdn');

  async function handleSubmit(formValues: AuthDomainFormValues) {
    const ingresses: ConfigIngressUpdateInput[] =
      formValues.auth_fqdn.length > 0 ? [{ fqdn: [formValues.auth_fqdn] }] : [];

    const updateConfigPromise = updateConfig({
      variables: {
        appId: currentProject.id,
        config: {
          auth: {
            resources: {
              networking: {
                ingresses,
              },
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
        loadingMessage: 'Auth domain is being updated...',
        successMessage: 'Auth domain has been updated successfully.',
        errorMessage:
          'An error occurred while trying to update the auth domain.',
      },
    );
  }

  const isDisabled = () => {
    if (!isPlatform) {
      return !isDirty || maintenanceActive;
    }

    return !isDirty || maintenanceActive || (!isVerified && !initialValue);
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsContainer
          title="Auth Domain"
          description="Enter below your custom domain for the authentication service."
          slotProps={{
            submitButton: {
              disabled: isDisabled(),
              loading: formState.isSubmitting,
            },
          }}
          className="grid grid-flow-row gap-x-4 gap-y-4 px-4 lg:grid-cols-5"
        >
          <Input
            {...register('auth_fqdn')}
            id="auth_fqdn"
            name="auth_fqdn"
            type="string"
            fullWidth
            className="col-span-5 lg:col-span-2"
            placeholder="auth.mydomain.dev"
            error={Boolean(formState.errors.auth_fqdn?.message)}
            helperText={formState.errors.auth_fqdn?.message}
            slotProps={{ inputRoot: { min: 1, max: 100 } }}
          />
          <div className="col-span-5 row-start-2">
            <VerifyDomain
              recordType="CNAME"
              hostname={auth_fqdn}
              value={`lb.${currentProject.region.name}.${currentProject.region.domain}.`}
              onHostNameVerified={() => setIsVerified(true)}
            />
          </div>
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}

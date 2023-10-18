import { useUI } from '@/components/common/UIProvider';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Input } from '@/components/ui/v2/Input';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { VerifyDomain } from '@/features/projects/custom-domains/settings/components/VerifyDomain';
import {
  useGetAuthenticationSettingsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { getToastStyleProps } from '@/utils/constants/settings';
import { getServerError } from '@/utils/getServerError';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  auth_fqdn: Yup.string().required(),
});

export type AuthDomainFormValues = Yup.InferType<typeof validationSchema>;

export default function AuthDomain() {
  const { maintenanceActive } = useUI();
  const [isVerified, setIsVerified] = useState(false);
  const { currentProject, refetch: refetchWorkspaceAndProject } =
    useCurrentWorkspaceAndProject();

  const [updateConfig] = useUpdateConfigMutation();

  const form = useForm<{ auth_fqdn: string }>({
    reValidateMode: 'onSubmit',
    defaultValues: { auth_fqdn: null },
    resolver: yupResolver(validationSchema),
  });

  const { data, loading, error } = useGetAuthenticationSettingsQuery({
    variables: {
      appId: currentProject.id,
    },
  });

  useEffect(() => {
    if (!loading && data) {
      const { networking } = data?.config?.auth?.resources || {};
      const fqdn = networking?.ingresses?.[0]?.fqdn?.[0];
      form.reset({ auth_fqdn: fqdn });
    }
  }, [data, loading, form]);

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
    const updateConfigPromise = updateConfig({
      variables: {
        appId: currentProject.id,
        config: {
          auth: {
            resources: {
              networking: {
                ingresses: [
                  {
                    fqdn: [formValues.auth_fqdn],
                  },
                ],
              },
            },
          },
        },
      },
    });

    try {
      await toast.promise(
        updateConfigPromise,
        {
          loading: `Auth domain is being updated...`,
          success: `Auth domain has been updated successfully.`,
          error: getServerError(
            `An error occurred while trying to update the auth domain.`,
          ),
        },
        getToastStyleProps(),
      );

      form.reset(formValues);
      await refetchWorkspaceAndProject();
    } catch {
      // Note: The toast will handle the error.
    }
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsContainer
          title="Auth Domain"
          description="Enter below your custom domain for the authentication service."
          slotProps={{
            submitButton: {
              disabled: !isDirty || maintenanceActive || !isVerified,
              loading: formState.isSubmitting,
            },
          }}
          className="grid grid-flow-row px-4 gap-y-4 gap-x-4 lg:grid-cols-5"
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
              value={`lb.${currentProject.region.awsName}.${currentProject.region.domain}.`}
              onHostNameVerified={() => setIsVerified(true)}
            />
          </div>
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}

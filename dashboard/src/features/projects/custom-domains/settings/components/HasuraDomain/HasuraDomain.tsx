import { useUI } from '@/components/common/UIProvider';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Input } from '@/components/ui/v2/Input';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { VerifyDomain } from '@/features/projects/custom-domains/settings/components/VerifyDomain';
import {
  useGetHasuraSettingsQuery,
  useUpdateConfigMutation,
  type ConfigIngressUpdateInput,
} from '@/generated/graphql';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  hasura_fqdn: Yup.string(),
});

export type HasuraDomainFormValues = Yup.InferType<typeof validationSchema>;

export default function HasuraDomain() {
  const { maintenanceActive } = useUI();
  const [isVerified, setIsVerified] = useState(false);
  const { currentProject, refetch: refetchWorkspaceAndProject } =
    useCurrentWorkspaceAndProject();

  const [updateConfig] = useUpdateConfigMutation();

  const form = useForm<Yup.InferType<typeof validationSchema>>({
    reValidateMode: 'onSubmit',
    defaultValues: { hasura_fqdn: null },
    resolver: yupResolver(validationSchema),
  });

  const { data, loading, error } = useGetHasuraSettingsQuery({
    variables: {
      appId: currentProject.id,
    },
  });

  const { networking } = data?.config?.hasura?.resources || {};
  const initialValue = networking?.ingresses?.[0]?.fqdn?.[0];

  useEffect(() => {
    if (!loading && data) {
      form.reset({ hasura_fqdn: initialValue });
    }
  }, [data, loading, form, initialValue]);

  if (loading) {
    return (
      <ActivityIndicator
        delay={0}
        label="Loading Hasura Domain..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const { formState, register, watch } = form;
  const isDirty = Object.keys(formState.dirtyFields).length > 0;

  const hasura_fqdn = watch('hasura_fqdn');

  async function handleSubmit(formValues: HasuraDomainFormValues) {
    const ingresses: ConfigIngressUpdateInput[] =
      formValues.hasura_fqdn.length > 0
        ? [{ fqdn: [formValues.hasura_fqdn] }]
        : [];

    const updateConfigPromise = updateConfig({
      variables: {
        appId: currentProject.id,
        config: {
          hasura: {
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
      },
      {
        loadingMessage: 'Hasura domain is being updated...',
        successMessage: 'Hasura domain has been updated successfully.',
        errorMessage:
          'An error occurred while trying to update the Hasura domain.',
      },
    );
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsContainer
          title="Hasura Domain"
          description="Enter below your custom domain for the Hasura/GraphQL service."
          slotProps={{
            submitButton: {
              disabled:
                !isDirty || maintenanceActive || (!isVerified && !initialValue),
              loading: formState.isSubmitting,
            },
          }}
          className="grid grid-flow-row gap-x-4 gap-y-4 px-4 lg:grid-cols-5"
        >
          <Input
            {...register('hasura_fqdn')}
            id="hasura_fqdn"
            name="hasura_fqdn"
            type="string"
            fullWidth
            className="col-span-5 lg:col-span-2"
            placeholder="auth.mydomain.dev"
            error={Boolean(formState.errors.hasura_fqdn?.message)}
            helperText={formState.errors.hasura_fqdn?.message}
            slotProps={{ inputRoot: { min: 1, max: 100 } }}
          />
          <div className="col-span-5 row-start-2">
            <VerifyDomain
              recordType="CNAME"
              hostname={hasura_fqdn}
              value={`lb.${currentProject.region.awsName}.${currentProject.region.domain}.`}
              onHostNameVerified={() => setIsVerified(true)}
            />
          </div>
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}

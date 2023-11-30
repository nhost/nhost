import { useUI } from '@/components/common/UIProvider';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Input } from '@/components/ui/v2/Input';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { VerifyDomain } from '@/features/projects/custom-domains/settings/components/VerifyDomain';
import {
  useGetServerlessFunctionsSettingsQuery,
  useUpdateConfigMutation,
  type ConfigIngressUpdateInput,
} from '@/generated/graphql';
import { getToastStyleProps } from '@/utils/constants/settings';
import { getServerError } from '@/utils/getServerError';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  functions_fqdn: Yup.string(),
});

export type ServerlessFunctionsDomainFormValues = Yup.InferType<
  typeof validationSchema
>;

export default function ServerlessFunctionsDomain() {
  const { maintenanceActive } = useUI();
  const [isVerified, setIsVerified] = useState(false);
  const { currentProject, refetch: refetchWorkspaceAndProject } =
    useCurrentWorkspaceAndProject();

  const [updateConfig] = useUpdateConfigMutation();

  const form = useForm<{ functions_fqdn: string }>({
    reValidateMode: 'onSubmit',
    defaultValues: { functions_fqdn: null },
    resolver: yupResolver(validationSchema),
  });

  const { data, loading, error } = useGetServerlessFunctionsSettingsQuery({
    variables: {
      appId: currentProject.id,
    },
  });

  const { networking } = data?.config?.functions?.resources || {};
  const initialValue = networking?.ingresses?.[0]?.fqdn?.[0];

  useEffect(() => {
    if (!loading && data) {
      form.reset({ functions_fqdn: initialValue });
    }
  }, [data, loading, form, initialValue]);

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading Serverless Functions Domain Settings..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const { formState, register, watch } = form;
  const isDirty = Object.keys(formState.dirtyFields).length > 0;

  const functions_fqdn = watch('functions_fqdn');

  async function handleSubmit(formValues: ServerlessFunctionsDomainFormValues) {
    const ingresses: ConfigIngressUpdateInput[] =
      formValues.functions_fqdn.length > 0
        ? [{ fqdn: [formValues.functions_fqdn] }]
        : [];

    const updateConfigPromise = updateConfig({
      variables: {
        appId: currentProject.id,
        config: {
          functions: {
            resources: {
              networking: {
                ingresses,
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
          loading: `Serverless Functions domain is being updated...`,
          success: `Serverless Functions domain has been updated successfully.`,
          error: getServerError(
            `An error occurred while trying to update the Serverless Functions domain.`,
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
          title="Serverless Functions Domain"
          description="Enter below your custom domain for Serverless Functions."
          slotProps={{
            submitButton: {
              disabled:
                !isDirty || maintenanceActive || (!isVerified && !initialValue),
              loading: formState.isSubmitting,
            },
          }}
          className="grid grid-flow-row px-4 gap-y-4 gap-x-4 lg:grid-cols-5"
        >
          <Input
            {...register('functions_fqdn')}
            id="functions_fqdn"
            name="functions_fqdn"
            type="string"
            fullWidth
            className="col-span-5 lg:col-span-2"
            placeholder="functions.mydomain.dev"
            error={Boolean(formState.errors.functions_fqdn?.message)}
            helperText={formState.errors.functions_fqdn?.message}
            slotProps={{ inputRoot: { min: 1, max: 100 } }}
          />
          <div className="col-span-5 row-start-2">
            <VerifyDomain
              recordType="CNAME"
              hostname={functions_fqdn}
              value={`lb.${currentProject.region.awsName}.${currentProject.region.domain}.`}
              onHostNameVerified={() => setIsVerified(true)}
            />
          </div>
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}

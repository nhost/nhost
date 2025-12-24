import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Input } from '@/components/ui/v2/Input';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { VerifyDomain } from '@/features/orgs/projects/custom-domains/settings/components/VerifyDomain';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { ConfigIngressUpdateInput } from '@/generated/graphql';
import {
  useGetHasuraSettingsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { isEmptyValue, isNotEmptyValue } from '@/lib/utils';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  hasura_fqdn: Yup.string(),
});

export type HasuraDomainFormValues = Yup.InferType<typeof validationSchema>;

export default function HasuraDomain() {
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const [isVerified, setIsVerified] = useState(false);

  const {
    project,
    refetch: refetchProject,
    loading: loadingProject,
  } = useProject();

  const [updateConfig] = useUpdateConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const form = useForm<Yup.InferType<typeof validationSchema>>({
    reValidateMode: 'onSubmit',
    defaultValues: { hasura_fqdn: '' },
    resolver: yupResolver(validationSchema),
  });

  const { data, loading, error } = useGetHasuraSettingsQuery({
    variables: {
      appId: project?.id,
    },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { networking } = data?.config?.hasura?.resources || {};
  const initialValue = networking?.ingresses?.[0]?.fqdn?.[0];

  useEffect(() => {
    if (!loading && data) {
      form.reset({ hasura_fqdn: initialValue });
    }
  }, [data, loading, form, initialValue]);

  const { formState, watch, setValue } = form;
  const isDirty = Object.keys(formState.dirtyFields).length > 0;

  const hasura_fqdn = watch('hasura_fqdn');

  const submitButtonDisabled = useMemo(() => {
    if (!isPlatform) {
      return !isDirty;
    }

    if (isEmptyValue(hasura_fqdn) && isDirty) {
      return false;
    }

    return !isDirty || !isVerified;
  }, [isPlatform, isDirty, hasura_fqdn, isVerified]);

  if (loadingProject || loading) {
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

  async function handleSubmit(formValues: HasuraDomainFormValues) {
    let ingresses: ConfigIngressUpdateInput[] | null;
    let successMessage = '';

    if (isNotEmptyValue(formValues.hasura_fqdn)) {
      ingresses = [{ fqdn: [formValues.hasura_fqdn] }];
      successMessage = 'Hasura domain has been updated successfully.';
    } else {
      ingresses = null;
      successMessage = 'Custom Hasura domain has been removed successfully.';
    }

    const updateConfigPromise = updateConfig({
      variables: {
        appId: project!.id,
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
        loadingMessage: 'Hasura domain is being updated...',
        successMessage,
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
              disabled: submitButtonDisabled,
              loading: formState.isSubmitting,
            },
          }}
          className="grid grid-flow-row gap-x-4 gap-y-4 px-4 lg:grid-cols-5"
        >
          <Input
            value={hasura_fqdn}
            onChange={(e) => {
              setValue('hasura_fqdn', e.target.value, {
                shouldDirty: true,
              });
              if (isVerified) {
                setIsVerified(false);
              }
            }}
            id="hasura_fqdn"
            name="hasura_fqdn"
            type="string"
            fullWidth
            className="col-span-5 lg:col-span-2"
            placeholder="graphql.mydomain.dev"
            error={Boolean(formState.errors.hasura_fqdn?.message)}
            helperText={formState.errors.hasura_fqdn?.message}
            slotProps={{ inputRoot: { min: 1, max: 100 } }}
          />
          <div className="col-span-5 row-start-2">
            <VerifyDomain
              recordType="CNAME"
              hostname={hasura_fqdn}
              value={`lb.${project?.region.name}.${project?.region.domain}.`}
              onHostNameVerified={() => setIsVerified(true)}
              saveEnabled={!submitButtonDisabled}
            />
          </div>
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}

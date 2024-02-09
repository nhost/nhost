import { useUI } from '@/components/common/UIProvider';
import { Form } from '@/components/form/Form';
import { Button } from '@/components/ui/v2/Button';
import { Input } from '@/components/ui/v2/Input';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { VerifyDomain } from '@/features/projects/custom-domains/settings/components/VerifyDomain';
import { useUpdateRunServiceConfigMutation } from '@/generated/graphql';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { yupResolver } from '@hookform/resolvers/yup';
import { type RunService } from 'pages/[workspaceSlug]/[appSlug]/services';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

interface RunServicePortProps {
  service: RunService;
  port: number;
}

const validationSchema = Yup.object({
  runServicePortFQDN: Yup.string(),
});

export type RunServicePortFormValues = Yup.InferType<typeof validationSchema>;

export default function RunServicePortDomain({
  service,
  port,
}: RunServicePortProps) {
  const { maintenanceActive } = useUI();
  const [loading, setLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const { currentProject } = useCurrentWorkspaceAndProject();

  const [updateRunServiceConfig] = useUpdateRunServiceConfigMutation();

  const runServicePort = service.config.ports.find((p) => p.port === port);
  const initialValue = runServicePort?.ingresses?.[0]?.fqdn?.[0];

  const form = useForm<RunServicePortFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      runServicePortFQDN: initialValue,
    },
    resolver: yupResolver(validationSchema),
  });

  const { formState, register, watch } = form;
  const isDirty = Object.keys(formState.dirtyFields).length > 0;

  const runServicePortFQDN = watch('runServicePortFQDN');

  async function handleSubmit(formValues: RunServicePortFormValues) {
    setLoading(true);

    await execPromiseWithErrorToast(
      async () => {
        await updateRunServiceConfig({
          variables: {
            appID: currentProject.id,
            serviceID: service.id,
            config: {
              ports: service?.config?.ports?.map((p) => {
                // exclude the `__typename` because the mutation will fail otherwise
                const { __typename, ...rest } = p;

                if (rest.port === port) {
                  return {
                    ...rest,
                    ingresses:
                      formValues.runServicePortFQDN.length > 0
                        ? [{ fqdn: [formValues.runServicePortFQDN] }]
                        : [],
                  };
                }

                return {
                  ...rest,
                  // exclude the `__typename` because the mutation will fail otherwise
                  ingresses: rest.ingresses.map((item) => ({
                    fqdn: item.fqdn,
                  })),
                };
              }),
            },
          },
        });

        form.reset(formValues);
      },
      {
        loadingMessage: `Port ${port} is being updated...`,
        successMessage: `Port ${port} has been updated successfully.`,
        errorMessage: `An error occurred while trying to update Port ${port}.`,
      },
    );

    setLoading(false);
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Text className="text-sm font-semibold">{`${runServicePort.type} <--> ${runServicePort.port}`}</Text>
          <div className="flex flex-row space-x-4">
            <Input
              {...register('runServicePortFQDN')}
              id="runServicePortFQDN"
              name="runServicePortFQDN"
              type="string"
              fullWidth
              className=""
              placeholder={`${service.config?.name ?? 'unset'}-${
                runServicePort.port
              }.mydomain.dev`}
              error={Boolean(formState.errors.runServicePortFQDN?.message)}
              helperText={formState.errors.runServicePortFQDN?.message}
              slotProps={{
                inputRoot: { min: 1, max: 100 },
              }}
            />
            <Button
              variant="outlined"
              type="submit"
              disabled={
                loading ||
                !isDirty ||
                maintenanceActive ||
                (!isVerified && !initialValue)
              }
            >
              Save
            </Button>
          </div>
        </div>

        <div className="col-span-5 row-start-2 mt-4">
          <VerifyDomain
            recordType="CNAME"
            hostname={runServicePortFQDN}
            value={`lb.${currentProject.region.awsName}.${currentProject.region.domain}.`}
            onHostNameVerified={() => setIsVerified(true)}
          />
        </div>
      </Form>
    </FormProvider>
  );
}

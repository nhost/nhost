import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { Form } from '@/components/form/Form';
import { Button } from '@/components/ui/v2/Button';
import { Input } from '@/components/ui/v2/Input';
import { Text } from '@/components/ui/v2/Text';
import { VerifyDomain } from '@/features/orgs/projects/custom-domains/settings/components/VerifyDomain';
import { useUpdateRunServiceConfigMutation } from '@/generated/graphql';
import { type RunService } from '@/hooks/useRunServices';
import { yupResolver } from '@hookform/resolvers/yup';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';

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
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const { maintenanceActive } = useUI();
  const localMimirClient = useLocalMimirClient();
  const [loading, setLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const { project } = useProject();

  const [updateRunServiceConfig] = useUpdateRunServiceConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

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
            appID: project.id,
            serviceID: service.id ?? service.serviceID,
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
                  ingresses: rest?.ingresses?.map((item) => ({
                    fqdn: item.fqdn,
                  })),
                };
              }),
            },
          },
        });

        form.reset(formValues);

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
        loadingMessage: `Port ${port} is being updated...`,
        successMessage: `Port ${port} has been updated successfully.`,
        errorMessage: `An error occurred while trying to update Port ${port}.`,
      },
    );

    setLoading(false);
  }

  const isDisabled = () => {
    if (!isPlatform) {
      return loading || !isDirty || maintenanceActive;
    }

    return (
      loading || !isDirty || maintenanceActive || (!isVerified && !initialValue)
    );
  };

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
            <Button variant="outlined" type="submit" disabled={isDisabled()}>
              Save
            </Button>
          </div>
        </div>

        <div className="col-span-5 row-start-2 mt-4">
          <VerifyDomain
            recordType="CNAME"
            hostname={runServicePortFQDN}
            value={`lb.${project.region.name}.${project.region.domain}.`}
            onHostNameVerified={() => setIsVerified(true)}
          />
        </div>
      </Form>
    </FormProvider>
  );
}

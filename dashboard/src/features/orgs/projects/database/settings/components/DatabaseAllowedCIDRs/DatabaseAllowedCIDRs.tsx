import { yupResolver } from '@hookform/resolvers/yup';
import { Plus, Trash } from 'lucide-react';
import { FormProvider, useFieldArray, useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { Input } from '@/components/ui/v2/Input';
import { Button } from '@/components/ui/v3/button';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  useGetPostgresSettingsQuery,
  useUpdateConfigMutation,
} from '@/utils/__generated__/graphql';

const MAX_CIDRS = 3;

const cidrRegex =
  /^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)\/(3[0-2]|[12]?\d)$/;

const allowedCIDRsValidationSchema = Yup.object({
  cidrs: Yup.array()
    .of(
      Yup.object({
        value: Yup.string()
          .required('CIDR is required')
          .matches(cidrRegex, 'Must be a valid CIDR (e.g., 192.168.1.0/24)'),
      }),
    )
    .max(MAX_CIDRS, `Up to ${MAX_CIDRS} CIDRs are allowed`),
});

type AllowedCIDRsFormValues = Yup.InferType<
  typeof allowedCIDRsValidationSchema
>;

export default function DatabaseAllowedCIDRs() {
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const { maintenanceActive } = useUI();
  const localMimirClient = useLocalMimirClient();
  const { project } = useProject();

  const { data } = useGetPostgresSettingsQuery({
    variables: { appId: project?.id },
    fetchPolicy: 'cache-only',
  });

  const [updateConfig] = useUpdateConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const enablePublicAccess =
    !!data?.config?.postgres?.resources?.enablePublicAccess;
  const allowedCIDRs = data?.config?.postgres?.resources?.allowedCIDRs ?? [];

  const form = useForm<AllowedCIDRsFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      cidrs: allowedCIDRs.map((cidr) => ({ value: cidr })),
    },
    resolver: yupResolver(allowedCIDRsValidationSchema),
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'cidrs',
  });

  if (!enablePublicAccess) {
    return null;
  }

  async function handleSubmit(formValues: AllowedCIDRsFormValues) {
    const cidrValues =
      formValues.cidrs?.map((c) => c.value).filter(Boolean) ?? [];

    const updateConfigPromise = updateConfig({
      variables: {
        appId: project?.id,
        config: {
          postgres: {
            resources: {
              allowedCIDRs: cidrValues.length > 0 ? cidrValues : null,
            },
          },
        },
      },
    });

    await execPromiseWithErrorToast(
      async () => {
        await updateConfigPromise;
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
        loadingMessage: 'Allowed CIDRs are being updated...',
        successMessage: 'Allowed CIDRs have been updated successfully.',
        errorMessage:
          'An error occurred while trying to update the allowed CIDRs.',
      },
    );
  }

  const { formState } = form;

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsContainer
          title="Allowed CIDRs"
          description="Restrict public access to your database to specific IP ranges. When no CIDRs are configured, all public IPs are allowed."
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty || maintenanceActive,
              loading: formState.isSubmitting,
            },
          }}
          className="grid grid-flow-row gap-4"
        >
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-start gap-2">
              <Input
                {...form.register(`cidrs.${index}.value`)}
                placeholder="e.g., 192.168.1.0/24"
                fullWidth
                hideEmptyHelperText
                error={!!formState.errors.cidrs?.[index]?.value}
                helperText={formState.errors.cidrs?.[index]?.value?.message}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => remove(index)}
              >
                <Trash className="size-4" />
              </Button>
            </div>
          ))}
          {fields.length < MAX_CIDRS && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="justify-self-start"
              onClick={() => append({ value: '' })}
            >
              <Plus className="mr-1 size-4" />
              Add CIDR
            </Button>
          )}
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}

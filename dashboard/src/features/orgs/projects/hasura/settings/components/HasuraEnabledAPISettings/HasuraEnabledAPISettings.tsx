import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/v3/form';
import {
  MultiSelect,
  MultiSelectContent,
  MultiSelectGroup,
  MultiSelectItem,
  MultiSelectTrigger,
  MultiSelectValue,
} from '@/components/ui/v3/multi-select';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  useGetHasuraSettingsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';

const validationSchema = Yup.object({
  enabledAPIs: Yup.array(
    Yup.object({
      label: Yup.string().required(),
      value: Yup.string().required(),
    }),
  )
    .label('Enabled Hasura APIs')
    .required(),
});

export type HasuraEnabledAPIFormValues = Yup.InferType<typeof validationSchema>;

const AVAILABLE_HASURA_APIS = ['metadata', 'graphql', 'pgdump', 'config'];

export default function HasuraEnabledAPISettings() {
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { project, refetch: refetchProject } = useProject();

  const [updateConfig] = useUpdateConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { data, loading, error } = useGetHasuraSettingsQuery({
    variables: { appId: project?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { enabledAPIs = [] } = data?.config?.hasura?.settings || {};

  const form = useForm<HasuraEnabledAPIFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      enabledAPIs: [],
    },
    resolver: yupResolver(validationSchema),
  });

  useEffect(() => {
    if (enabledAPIs && !loading) {
      form.reset({
        enabledAPIs: enabledAPIs.map((api) => ({ label: api, value: api })),
      });
    }
  }, [form, enabledAPIs, loading]);

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading enabled APIs..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const { formState } = form;
  const isDirty = Object.keys(formState.dirtyFields).length > 0;

  const availableAPIs = AVAILABLE_HASURA_APIS.map((api) => ({
    label: api,
    value: api,
  }));

  async function handleSubmit(formValues: HasuraEnabledAPIFormValues) {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project?.id,
        config: {
          hasura: {
            settings: {
              enabledAPIs: formValues.enabledAPIs.map((api) => api.value),
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
        loadingMessage: 'Enabled APIs are being updated...',
        successMessage: 'Enabled APIs have been updated successfully.',
        errorMessage: 'An error occurred while trying to update enabled APIs.',
      },
    );
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsContainer
          title="Enabled APIs"
          description="Enable or disable APIs for your Hasura instance."
          slotProps={{
            submitButton: {
              disabled: !isDirty,
              loading: formState.isSubmitting,
            },
          }}
          className="grid grid-flow-row gap-x-4 gap-y-2 px-4 lg:grid-cols-6"
        >
          <FormField
            control={form.control}
            name="enabledAPIs"
            render={({ field }) => (
              <FormItem className="lg:col-span-3">
                <MultiSelect
                  values={(field.value || []).map(
                    // biome-ignore lint/suspicious/noExplicitAny: Will be fixed later.
                    (v: any) => v.value,
                  )}
                  onValuesChange={(nextValues) =>
                    field.onChange(
                      nextValues.map((v) => ({ label: v, value: v })),
                    )
                  }
                >
                  <FormControl>
                    <MultiSelectTrigger className="w-full rounded-sm hover:bg-accent-background dark:border-[#2f363d] dark:bg-[#171d26] dark:hover:bg-[#1b2534]">
                      <MultiSelectValue
                        placeholder="Select Enabled APIs"
                        placeHolderClassName="text-[#9ca7b7]"
                      />
                    </MultiSelectTrigger>
                  </FormControl>
                  <MultiSelectContent>
                    <MultiSelectGroup>
                      {availableAPIs.map((opt) => (
                        <MultiSelectItem
                          key={opt.value}
                          value={opt.value}
                          className="data-[selected='true']:bg-accent data-[selected='true']:dark:bg-[#1b2534]"
                        >
                          {opt.label}
                        </MultiSelectItem>
                      ))}
                    </MultiSelectGroup>
                  </MultiSelectContent>
                </MultiSelect>
                {!!formState.errors?.enabledAPIs?.message && (
                  <FormMessage>
                    {formState.errors?.enabledAPIs?.message}
                  </FormMessage>
                )}
              </FormItem>
            )}
          />
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}

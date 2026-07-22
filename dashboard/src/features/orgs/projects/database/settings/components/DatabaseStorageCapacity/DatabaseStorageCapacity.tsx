import { yupResolver } from '@hookform/resolvers/yup';
import Link from 'next/link';
import { useEffect, useMemo } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { Form } from '@/components/form/Form';
import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardFooter,
  SettingsCardHeader,
} from '@/components/layout/SettingsCard';
import { Alert } from '@/components/ui/v3/alert';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/v3/form';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/v3/input-group';
import { useAppState } from '@/features/orgs/projects/common/hooks/useAppState';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { DatabaseStorageCapacityWarning } from '@/features/orgs/projects/database/settings/components/DatabaseStorageCapacityWarning';
import { UpgradeNotification } from '@/features/orgs/projects/database/settings/components/UpgradeNotification';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  useGetPersistentVolumesEncryptedQuery,
  useGetPostgresSettingsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { isEmptyValue } from '@/lib/utils';
import { ApplicationStatus } from '@/types/application';

const validationSchema = Yup.object({
  capacity: Yup.number()
    .integer('Capacity must be an integer')
    .typeError('You must specify a number')
    .min(1, 'Capacity must be greater than 0')
    .required('Capacity is required'),
});

export type DatabaseStorageCapacityFormValues = Yup.InferType<
  typeof validationSchema
>;

export default function DatabaseStorageCapacity() {
  const isPlatform = useIsPlatform();
  const { org } = useCurrentOrg();
  const localMimirClient = useLocalMimirClient();
  const { project } = useProject();

  const isFreeProject = isEmptyValue(org) ? false : org.plan.isFree;

  const shouldShowUpdateCapacityWarning = !isFreeProject && isPlatform;

  const {
    data,
    loading,
    error,
    refetch: refetchPostgresSettings,
  } = useGetPostgresSettingsQuery({
    variables: { appId: project?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const capacity =
    (data?.config?.postgres?.resources?.storage?.capacity ??
      org?.plan?.featureMaxDbSize) ||
    0;

  const { data: encryptedVolumesData } = useGetPersistentVolumesEncryptedQuery({
    variables: { appId: project?.id },
    skip: !isPlatform,
  });

  const showEncryptionWarning = encryptedVolumesData
    ? !encryptedVolumesData?.systemConfig?.persistentVolumesEncrypted
    : false;

  const [updateConfig] = useUpdateConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const form = useForm<Yup.InferType<typeof validationSchema>>({
    reValidateMode: 'onSubmit',
    defaultValues: { capacity },
    resolver: yupResolver(validationSchema),
  });

  const { state } = useAppState();

  const applicationPause =
    state === ApplicationStatus.Paused || state === ApplicationStatus.Pausing;

  const { formState, reset, watch } = form;
  const isDirty = Object.keys(formState.dirtyFields).length > 0;
  const newCapacity = watch('capacity');

  const decreasingSize = newCapacity < capacity;

  const submitDisabled = useMemo(() => {
    if (!isDirty) {
      return true;
    }

    if (!isPlatform) {
      return false;
    }

    if (decreasingSize && !applicationPause) {
      return true;
    }

    return false;
  }, [isDirty, decreasingSize, applicationPause, isPlatform]);

  useEffect(() => {
    if (data && !loading) {
      reset({ capacity });
    }
  }, [loading, data, reset, capacity]);

  if (error) {
    throw error;
  }

  async function handleSubmit(formValues: DatabaseStorageCapacityFormValues) {
    await execPromiseWithErrorToast(
      async () => {
        await updateConfig({
          variables: {
            appId: project?.id,
            config: {
              postgres: {
                resources: {
                  storage: {
                    capacity: formValues.capacity,
                  },
                },
              },
            },
          },
        });

        form.reset(formValues);
        await refetchPostgresSettings();
      },
      {
        loadingMessage: 'Database storage capacity is being updated...',
        successMessage:
          'Database storage capacity has been updated successfully.',
        errorMessage:
          'An error occurred while trying to update the database storage capacity.',
      },
    );
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsCard>
          <SettingsCardHeader
            title="Storage capacity"
            description="Specify the storage capacity for your PostgreSQL database."
          />

          <SettingsCardContent className="flex flex-col">
            {isFreeProject && (
              <UpgradeNotification description="To unlock more storage capacity, transfer this project to a Pro or Team organization." />
            )}
            <div className="grid grid-flow-row lg:grid-cols-5">
              <FormField
                control={form.control}
                name="capacity"
                render={({ field }) => (
                  <FormItem className="lg:col-span-2">
                    <FormControl>
                      <InputGroup>
                        <InputGroupInput
                          id="capacity"
                          type="text"
                          disabled={isFreeProject}
                          {...field}
                        />
                        <InputGroupAddon align="inline-end">GB</InputGroupAddon>
                      </InputGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {shouldShowUpdateCapacityWarning && (
              <DatabaseStorageCapacityWarning
                state={state}
                decreasingSize={decreasingSize}
                isDirty={isDirty}
              />
            )}
            {showEncryptionWarning ? (
              <Alert className="flex flex-col gap-3 text-left">
                <div className="flex flex-col gap-2 lg:flex-row lg:justify-between">
                  <p className="flex items-start gap-1 font-semibold">
                    Disk encryption is now available!
                  </p>
                </div>
                <div>
                  <p>
                    To enable encryption in this project all you have to do is
                    pause & unpause it in{' '}
                    <Link
                      href={`/orgs/${org?.slug}/projects/${project?.subdomain}/settings`}
                      className="text-primary hover:underline"
                    >
                      General Settings
                    </Link>
                    .
                  </p>
                </div>
              </Alert>
            ) : null}
          </SettingsCardContent>

          <SettingsCardFooter>
            <ButtonWithLoading
              type="submit"
              disabled={submitDisabled}
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

import {
  BaseCronTriggerForm,
  type BaseCronTriggerFormTriggerProps,
} from '@/features/orgs/projects/events/cron-triggers/components/BaseCronTriggerForm';
import type {
  BaseCronTriggerFormInitialData,
  BaseCronTriggerFormValues,
} from '@/features/orgs/projects/events/cron-triggers/components/BaseCronTriggerForm/BaseCronTriggerFormTypes';
import { useCreateCronTriggerMutation } from '@/features/orgs/projects/events/cron-triggers/hooks/useCreateCronTriggerMutation';
import { buildCronTriggerDTO } from '@/features/orgs/projects/events/cron-triggers/utils/buildCronTriggerDTO';
import { parseCronTriggerFormInitialData } from '@/features/orgs/projects/events/cron-triggers/utils/parseCronTriggerFormInitialData';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { CronTrigger } from '@/utils/hasura-api/generated/schemas';
import { useRouter } from 'next/router';
import { useEffect, useState, type ReactNode } from 'react';

export interface EditCronTriggerFormProps {
  cronTrigger: CronTrigger;
  trigger: (props: BaseCronTriggerFormTriggerProps) => ReactNode;
}

export default function EditCronTriggerForm({
  cronTrigger,
  trigger,
}: EditCronTriggerFormProps) {
  const router = useRouter();
  const { orgSlug, appSubdomain } = router.query;
  const [initialData, setInitialData] =
    useState<BaseCronTriggerFormInitialData>(() =>
      parseCronTriggerFormInitialData(cronTrigger),
    );

  useEffect(() => {
    setInitialData(parseCronTriggerFormInitialData(cronTrigger));
  }, [cronTrigger]);

  // We use the same mutation for create and edit, with a `replace` flag
  const { mutateAsync: createCronTrigger } = useCreateCronTriggerMutation();

  const handleSubmit = async (data: BaseCronTriggerFormValues) => {
    await execPromiseWithErrorToast(
      async () => {
        const cronTriggerDTO = buildCronTriggerDTO({
          formValues: data,
          isEdit: true,
        });
        await createCronTrigger({
          args: cronTriggerDTO,
        });
        setInitialData(data);
        router.push(
          `/orgs/${orgSlug}/projects/${appSubdomain}/events/cron-trigger/${data.triggerName}`,
        );
      },
      {
        loadingMessage: 'Editing cron trigger...',
        successMessage: 'The cron trigger has been edited successfully.',
        errorMessage:
          'An error occurred while editing the cron trigger. Please try again.',
      },
    );
  };

  return (
    <BaseCronTriggerForm
      trigger={trigger}
      onSubmit={handleSubmit}
      isEditing
      initialData={initialData}
      titleText="Edit Cron Trigger"
      descriptionText="Enter the details to edit your cron trigger. Click Save when you're done."
      submitButtonText="Save"
    />
  );
}

import { Plus } from 'lucide-react';
import { useRouter } from 'next/router';
import SidebarIconAction from '@/features/orgs/projects/events/cron-jobs/components/SidebarIconAction';
import {
  cronJobsPath,
  webhookJobPath,
} from '@/features/orgs/projects/events/cron-jobs/cron-jobs-path';
import {
  BaseCronTriggerForm,
  type BaseCronTriggerFormTriggerProps,
} from '@/features/orgs/projects/events/cron-triggers/components/BaseCronTriggerForm';
import type { BaseCronTriggerFormValues } from '@/features/orgs/projects/events/cron-triggers/components/BaseCronTriggerForm/BaseCronTriggerFormTypes';
import { useCreateCronTriggerMutation } from '@/features/orgs/projects/events/cron-triggers/hooks/useCreateCronTriggerMutation';
import { buildCronTriggerDTO } from '@/features/orgs/projects/events/cron-triggers/utils/buildCronTriggerDTO';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useTrackEvent } from '@/hooks/useTrackEvent';

const renderCreateCronTriggerButton = ({
  open,
}: BaseCronTriggerFormTriggerProps) => (
  <SidebarIconAction label="New webhook job" onClick={open}>
    <Plus />
  </SidebarIconAction>
);

export default function CreateCronTriggerForm() {
  const { mutateAsync: createCronTrigger } = useCreateCronTriggerMutation();
  const track = useTrackEvent();
  const router = useRouter();
  const { orgSlug, appSubdomain } = router.query;

  const handleSubmit = async (data: BaseCronTriggerFormValues) => {
    await execPromiseWithErrorToast(
      async () => {
        const cronTriggerDTO = buildCronTriggerDTO({ formValues: data });
        await createCronTrigger({
          args: cronTriggerDTO,
        });
        track('Cron Trigger Created');
        router.push(
          webhookJobPath(cronJobsPath(orgSlug, appSubdomain), data.triggerName),
        );
      },
      {
        loadingMessage: 'Creating webhook job...',
        successMessage: 'The webhook job has been created successfully.',
        errorMessage:
          'An error occurred while creating the webhook job. Please try again.',
      },
    );
  };

  return (
    <BaseCronTriggerForm
      trigger={renderCreateCronTriggerButton}
      onSubmit={handleSubmit}
      titleText="Create webhook job"
      descriptionText="Enter the details to create your webhook job. Click Create when you're done."
      submitButtonText="Create"
    />
  );
}

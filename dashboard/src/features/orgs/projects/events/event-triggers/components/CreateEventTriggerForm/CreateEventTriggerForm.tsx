import { Button } from '@/components/ui/v3/button';
import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import {
  BaseEventTriggerForm,
  type BaseEventTriggerFormTriggerProps,
} from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm';
import type { BaseEventTriggerFormValues } from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm/BaseEventTriggerFormTypes';
import { useCreateEventTriggerMutation } from '@/features/orgs/projects/events/event-triggers/hooks/useCreateEventTriggerMutation';
import { buildEventTriggerDTO } from '@/features/orgs/projects/events/event-triggers/utils/buildEventTriggerDTO';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/router';

const renderCreateEventTriggerButton = ({
  open,
}: BaseEventTriggerFormTriggerProps) => (
  <Button
    variant="ghost"
    size="icon"
    aria-label="Add event trigger"
    onClick={() => open()}
  >
    <Plus className="h-5 w-5 text-primary dark:text-foreground" />
  </Button>
);

export default function CreateEventTriggerForm() {
  const { mutateAsync: createEventTrigger } = useCreateEventTriggerMutation();
  const { data: resourceVersion } = useGetMetadataResourceVersion();
  const router = useRouter();
  const { orgSlug, appSubdomain } = router.query;

  const handleSubmit = async (data: BaseEventTriggerFormValues) => {
    const eventTriggerDTO = buildEventTriggerDTO({ formValues: data });
    await execPromiseWithErrorToast(
      async () => {
        await createEventTrigger({
          args: eventTriggerDTO,
          resourceVersion: resourceVersion ?? undefined,
        });
        router.push(
          `/orgs/${orgSlug}/projects/${appSubdomain}/events/event-triggers/${data.triggerName}`,
        );
      },
      {
        loadingMessage: 'Creating event trigger...',
        successMessage: 'The event trigger has been created successfully.',
        errorMessage:
          'An error occurred while creating the event trigger. Please try again.',
      },
    );
  };

  return (
    <BaseEventTriggerForm
      trigger={renderCreateEventTriggerButton}
      onSubmit={handleSubmit}
      titleText="Create a New Event Trigger"
      descriptionText="Enter the details to create your event trigger. Click Create when you're done."
      submitButtonText="Create"
    />
  );
}

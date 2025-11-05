import type { BaseEventTriggerFormValues } from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm/BaseEventTriggerFormTypes';
import { useTestWebhookTransformQuery } from '@/features/orgs/projects/events/event-triggers/hooks/useTestWebhookTransformQuery';
import buildTestWebhookTransformDTO from '@/features/orgs/projects/events/event-triggers/utils/buildTestWebhookTransformDTO/buildTestWebhookTransformDTO';
import { useFormContext } from 'react-hook-form';

export default function TransformedRequestBody() {
  const form = useFormContext<BaseEventTriggerFormValues>();
  const values = form.watch();
  const args = buildTestWebhookTransformDTO({ formValues: values });
  const { data, isLoading } = useTestWebhookTransformQuery(args);
  console.log('data', data, 'isLoading', isLoading);

  return <div>{JSON.stringify(data?.body, null, 2)}</div>;
}

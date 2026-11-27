import { zodResolver } from '@hookform/resolvers/zod';
import { type ReactNode, useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { DiscardChangesDialog } from '@/components/common/DiscardChangesDialog';
import { FormInput } from '@/components/form/FormInput';
import { FormTextarea } from '@/components/form/FormTextarea';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v3/dialog';
import { Form } from '@/components/ui/v3/form';
import { Switch } from '@/components/ui/v3/switch';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/v3/tabs';
import { InfoTooltip } from '@/features/orgs/projects/common/components/InfoTooltip';
import { HeadersFormSection } from '@/features/orgs/projects/events/common/components/HeadersFormSection';
import { PayloadTransformFormSection } from '@/features/orgs/projects/events/common/components/PayloadTransformFormSection';
import { RequestOptionsFormSection } from '@/features/orgs/projects/events/common/components/RequestOptionsFormSection';
import { RetryConfigurationFormSection } from '@/features/orgs/projects/events/common/components/RetryConfigurationFormSection';
import { CronScheduleInput } from '@/features/orgs/projects/events/cron-triggers/components/CronScheduleInput';
import { getCronTriggerSampleInputPayload } from '@/features/orgs/projects/events/cron-triggers/utils/getCronTriggerSampleInputPayload';
import {
  type BaseCronTriggerFormInitialData,
  type BaseCronTriggerFormValues,
  defaultFormValues,
  defaultPayloadTransformValues,
  defaultRequestOptionsTransformValues,
  validationSchema,
} from './BaseCronTriggerFormTypes';

type FormTab = 'general' | 'delivery' | 'request' | 'payload';

const GENERAL_FIELDS = [
  'triggerName',
  'comment',
  'webhook',
  'schedule',
  'payload',
];
const DELIVERY_FIELDS = ['retryConf', 'headers'];

export interface BaseCronTriggerFormTriggerProps {
  open: () => void;
}

export interface BaseCronTriggerFormProps {
  initialData?: BaseCronTriggerFormInitialData;
  trigger?: (props: BaseCronTriggerFormTriggerProps) => ReactNode;
  onSubmit: (data: BaseCronTriggerFormValues) => void | Promise<void>;
  isEditing?: boolean;
  submitButtonText: string;
  titleText: string;
  descriptionText: string;
}

export default function BaseCronTriggerForm({
  initialData,
  trigger,
  isEditing,
  onSubmit,
  titleText,
  descriptionText,
  submitButtonText,
}: BaseCronTriggerFormProps) {
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] =
    useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [tab, setTab] = useState<FormTab>('general');
  const [isRequestOptionsSectionOpen, setIsRequestOptionsSectionOpen] =
    useState(Boolean(initialData?.requestOptionsTransform));
  const [isPayloadSectionOpen, setIsPayloadSectionOpen] = useState(
    Boolean(initialData?.payloadTransform),
  );

  const form = useForm<BaseCronTriggerFormValues>({
    resolver: zodResolver(validationSchema),
    defaultValues: initialData ?? defaultFormValues,
  });

  const { watch, reset, setValue } = form;
  const { isDirty } = form.formState;

  const resetFormValues = useCallback(() => {
    reset(initialData ?? defaultFormValues);
    setIsRequestOptionsSectionOpen(
      Boolean(initialData?.requestOptionsTransform),
    );
    setIsPayloadSectionOpen(Boolean(initialData?.payloadTransform));
  }, [initialData, reset]);

  const openForm = useCallback(() => {
    resetFormValues();
    setShowUnsavedChangesDialog(false);
    setIsSheetOpen(true);
    setTab('general');
  }, [resetFormValues]);

  const closeForm = useCallback(
    (options?: { reset?: boolean }) => {
      if (options?.reset !== false) {
        resetFormValues();
      }
      setIsSheetOpen(false);
      setShowUnsavedChangesDialog(false);
    },
    [resetFormValues],
  );

  const handleSheetOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        return;
      }

      if (isDirty) {
        setShowUnsavedChangesDialog(true);
        return;
      }

      closeForm();
    },
    [closeForm, isDirty],
  );

  const handleFormSubmit = form.handleSubmit(
    async (values) => {
      await onSubmit(values);
      closeForm();
    },
    (errors) => {
      const fields = Object.keys(errors);
      if (fields.some((field) => GENERAL_FIELDS.includes(field))) {
        setTab('general');
      } else if (fields.some((field) => DELIVERY_FIELDS.includes(field))) {
        setTab('delivery');
      } else if (fields.includes('requestOptionsTransform')) {
        setTab('request');
      } else {
        setTab('payload');
      }
    },
  );

  const isRequestOptionsTransformEnabled = Boolean(
    watch('requestOptionsTransform'),
  );
  const isPayloadTransformEnabled = Boolean(watch('payloadTransform'));

  const toggleRequestOptionsSectionOpen = useCallback(() => {
    setIsRequestOptionsSectionOpen((prev) => {
      const next = !prev;

      if (next && !isRequestOptionsTransformEnabled) {
        setValue(
          'requestOptionsTransform',
          defaultRequestOptionsTransformValues,
          { shouldDirty: true },
        );
      } else {
        setValue('requestOptionsTransform', undefined, { shouldDirty: true });
      }

      return next;
    });
  }, [isRequestOptionsTransformEnabled, setValue]);

  const togglePayloadSectionOpen = useCallback(() => {
    setIsPayloadSectionOpen((prev) => {
      const next = !prev;

      if (next && !isPayloadTransformEnabled) {
        setValue('payloadTransform', defaultPayloadTransformValues, {
          shouldDirty: true,
        });
      } else {
        setValue('payloadTransform', undefined, { shouldDirty: true });
      }

      return next;
    });
  }, [isPayloadTransformEnabled, setValue]);

  const handleResetSampleInput = useCallback(() => {
    const values = form.getValues();
    form.setValue(
      'payloadTransform.sampleInput',
      getCronTriggerSampleInputPayload(values.payload),
    );
  }, [form]);

  const handleDiscardChanges = () => {
    closeForm();
  };

  const triggerNode = trigger?.({ open: openForm }) ?? null;

  return (
    <>
      {triggerNode}
      <Dialog open={isSheetOpen} onOpenChange={handleSheetOpenChange}>
        <DialogContent
          disableOutsideClick
          className="flex max-h-[90vh] max-w-3xl flex-col gap-0 overflow-hidden p-0 text-foreground"
        >
          <Form {...form}>
            <form
              id="cron-trigger-form"
              onSubmit={handleFormSubmit}
              className="flex min-h-0 flex-1 flex-col"
            >
              <Tabs
                value={tab}
                onValueChange={(value) => setTab(value as FormTab)}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="flex flex-col gap-6 px-8 pt-8 pb-4">
                  <DialogHeader>
                    <DialogTitle className="text-xl">{titleText}</DialogTitle>
                    <DialogDescription>{descriptionText}</DialogDescription>
                  </DialogHeader>
                  <TabsList className="self-start">
                    <TabsTrigger value="general">General</TabsTrigger>
                    <TabsTrigger value="delivery">Delivery</TabsTrigger>
                    <TabsTrigger value="request">Request</TabsTrigger>
                    <TabsTrigger value="payload">Payload</TabsTrigger>
                  </TabsList>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-8 py-4">
                  <TabsContent value="general" className="mt-0 space-y-6">
                    <div className="grid gap-6 sm:grid-cols-2">
                      <FormInput
                        control={form.control}
                        name="triggerName"
                        label="Name"
                        placeholder="cron_trigger_name"
                        autoFocus
                        disabled={isEditing}
                        autoComplete="off"
                      />
                      <FormInput
                        control={form.control}
                        name="comment"
                        label="Description"
                        placeholder="What this job does"
                        autoComplete="off"
                      />
                    </div>
                    <FormInput
                      control={form.control}
                      name="webhook"
                      placeholder="{{NHOST_FUNCTIONS_URL}}/handler or https://httpbin.org/post"
                      label={
                        <div className="flex flex-row items-center gap-2">
                          Webhook URL or template{' '}
                          <InfoTooltip>
                            Environment variables and secrets are available
                            using the {'{{VARIABLE}}'} tag.
                          </InfoTooltip>
                        </div>
                      }
                    />
                    <CronScheduleInput
                      control={form.control}
                      name="schedule"
                      label="Schedule"
                      placeholder="* * * * *"
                      containerClassName="w-full"
                      className="w-full aria-[invalid=true]:border-destructive aria-[invalid=true]:focus:border-destructive aria-[invalid=true]:focus:ring-destructive/20"
                    />
                    <FormTextarea
                      control={form.control}
                      name="payload"
                      placeholder={`{
  "name": "John Doe",
  "company": "Acme"
}`}
                      label={
                        <div className="flex flex-row items-center gap-2">
                          Payload{' '}
                          <InfoTooltip>
                            The JSON sent to the webhook on every run.
                          </InfoTooltip>
                        </div>
                      }
                      className="min-h-40 font-mono"
                    />
                  </TabsContent>
                  <TabsContent value="delivery" className="mt-0 space-y-4">
                    <div className="rounded-lg border p-6">
                      <RetryConfigurationFormSection
                        showToleranceSec
                        className="pl-0"
                      />
                    </div>
                    <div className="rounded-lg border p-6">
                      <HeadersFormSection className="pl-0" />
                    </div>
                  </TabsContent>
                  <TabsContent value="request" className="mt-0">
                    <TransformToggle
                      title="Transform request options"
                      description="Change the method, URL or query parameters before the request is sent."
                      checked={isRequestOptionsSectionOpen}
                      onCheckedChange={toggleRequestOptionsSectionOpen}
                    >
                      {isRequestOptionsTransformEnabled && (
                        <RequestOptionsFormSection className="pl-0" />
                      )}
                    </TransformToggle>
                  </TabsContent>
                  <TabsContent value="payload" className="mt-0">
                    <TransformToggle
                      title="Transform payload"
                      description="Change the request body before it is sent."
                      checked={isPayloadSectionOpen}
                      onCheckedChange={togglePayloadSectionOpen}
                    >
                      {isPayloadTransformEnabled && (
                        <PayloadTransformFormSection
                          className="pl-0"
                          onResetSampleInput={handleResetSampleInput}
                        />
                      )}
                    </TransformToggle>
                  </TabsContent>
                </div>
              </Tabs>
              <div className="flex justify-end gap-2 border-t px-8 py-4">
                <Button
                  type="button"
                  variant="outline"
                  disabled={form.formState.isSubmitting}
                  onClick={() => handleSheetOpenChange(false)}
                >
                  Cancel
                </Button>
                <ButtonWithLoading
                  type="submit"
                  loading={form.formState.isSubmitting}
                  disabled={
                    form.formState.isSubmitting || !form.formState.isDirty
                  }
                >
                  {submitButtonText}
                </ButtonWithLoading>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <DiscardChangesDialog
        open={showUnsavedChangesDialog}
        onOpenChange={setShowUnsavedChangesDialog}
        onDiscardChanges={handleDiscardChanges}
      />
    </>
  );
}

function TransformToggle({
  title,
  description,
  checked,
  onCheckedChange,
  children,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: VoidFunction;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border">
      <div className="flex items-start justify-between gap-4 p-6">
        <div className="space-y-1">
          <h3 className="font-medium text-base">{title}</h3>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
        <Switch
          type="button"
          aria-label={title}
          checked={checked}
          onCheckedChange={onCheckedChange}
        />
      </div>
      {checked && <div className="border-t p-6">{children}</div>}
    </section>
  );
}

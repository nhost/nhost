import { DiscardChangesDialog } from '@/components/common/DiscardChangesDialog';
import { FormInput } from '@/components/form/FormInput';
import { FormTextarea } from '@/components/form/FormTextarea';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/v3/accordion';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Form } from '@/components/ui/v3/form';
import { Separator } from '@/components/ui/v3/separator';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/v3/sheet';
import { InfoTooltip } from '@/features/orgs/projects/common/components/InfoTooltip';
import { CronScheduleInput } from '@/features/orgs/projects/events/cron-triggers/components/CronScheduleInput';
import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { PlusIcon, TrashIcon } from 'lucide-react';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import {
  defaultFormValues,
  defaultPayloadTransformValues,
  defaultRequestOptionsTransformValues,
  validationSchema,
  type BaseCronTriggerFormInitialData,
  type BaseCronTriggerFormValues,
} from './BaseCronTriggerFormTypes';
import HeadersSection from './sections/HeadersSection';
import PayloadTransformSection from './sections/PayloadTransformSection/PayloadTransformSection';
import { RequestOptionsSection } from './sections/RequestOptionsSection';
import RetryConfigurationSection from './sections/RetryConfigurationSection';

const ACCORDION_SECTION_VALUES = [
  'retry-configuration',
  'transformation-configuration',
] as const;

type AccordionSectionValue = (typeof ACCORDION_SECTION_VALUES)[number];

export interface BaseCronTriggerFormTriggerProps {
  open: () => void;
}

export interface BaseCronTriggerFormProps {
  initialData?: BaseCronTriggerFormInitialData;
  trigger: (props: BaseCronTriggerFormTriggerProps) => ReactNode;
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
  const [openAccordionSections, setOpenAccordionSections] = useState<
    AccordionSectionValue[]
  >([]);
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

  const sheetContentRef = useRef<HTMLDivElement | null>(null);

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
    setOpenAccordionSections([]);
  }, [resetFormValues]);

  const closeForm = useCallback(
    (options?: { reset?: boolean }) => {
      if (options?.reset !== false) {
        resetFormValues();
      }
      setIsSheetOpen(false);
      setShowUnsavedChangesDialog(false);
      setOpenAccordionSections([]);
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
    () => {
      setOpenAccordionSections([...ACCORDION_SECTION_VALUES]);
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

  const handleDiscardChanges = () => {
    closeForm();
  };

  const triggerNode = trigger({ open: openForm });

  const handleAccordionValueChange = useCallback((value: string[]) => {
    setOpenAccordionSections(value as AccordionSectionValue[]);
  }, []);

  return (
    <>
      {triggerNode}
      <Sheet open={isSheetOpen} onOpenChange={handleSheetOpenChange}>
        <SheetContent
          ref={sheetContentRef}
          showOverlay
          className="w-xl md:w-4xl box flex flex-auto flex-col gap-0 p-0 sm:max-w-4xl"
        >
          <SheetHeader className="p-6">
            <SheetTitle className="text-lg">{titleText}</SheetTitle>
            <SheetDescription>{descriptionText}</SheetDescription>
          </SheetHeader>
          <Separator />
          <Form {...form}>
            <form
              id="cron-trigger-form"
              onSubmit={handleFormSubmit}
              className="flex flex-auto flex-col gap-4 overflow-y-auto pb-4"
            >
              <div className="flex flex-auto flex-col">
                <div className="flex flex-col gap-6 p-6 text-foreground">
                  <FormInput
                    control={form.control}
                    name="triggerName"
                    label="Cron Trigger Name"
                    placeholder="cron_trigger_name"
                    disabled={isEditing}
                    className="max-w-lg"
                    autoComplete="off"
                  />
                  <FormInput
                    control={form.control}
                    name="comment"
                    label="Comment"
                    placeholder="A statement to help describe the cron trigger in brief"
                    className="max-w-lg"
                    autoComplete="off"
                  />
                  <Separator />
                  <FormInput
                    control={form.control}
                    name="webhook"
                    placeholder="https://httpbin.org/post or {{MY_WEBHOOK_URL}}/handler"
                    label={
                      <div className="flex flex-row items-center gap-2">
                        Webhook URL or template{' '}
                        <InfoTooltip>
                          Environment variables and secrets are available using
                          the {'{{VARIABLE}}'} tag.
                        </InfoTooltip>
                      </div>
                    }
                    className="max-w-lg text-foreground"
                  />
                  <CronScheduleInput
                    control={form.control}
                    name="schedule"
                    label={
                      <div className="flex flex-row items-center gap-2">
                        Schedule (Cron Expression){' '}
                        <InfoTooltip>
                          Schedule for your cron (events are created based on
                          the UTC timezone)
                        </InfoTooltip>
                      </div>
                    }
                    placeholder="* * * * *"
                    containerClassName="w-60"
                    className="w-full text-foreground aria-[invalid=true]:border-destructive aria-[invalid=true]:focus:border-destructive aria-[invalid=true]:focus:ring-destructive/20"
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
                          The request payload for the cron trigger, should be a
                          valid JSON
                        </InfoTooltip>
                      </div>
                    }
                    className="min-h-[250px] max-w-lg font-mono text-foreground"
                  />
                </div>
                <Separator />
                <Accordion
                  type="multiple"
                  value={openAccordionSections}
                  onValueChange={handleAccordionValueChange}
                >
                  <AccordionItem value="retry-configuration" className="px-6">
                    <AccordionTrigger className="text-base text-foreground">
                      Retry and Headers Settings
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="flex flex-col gap-8 border-l">
                        <RetryConfigurationSection className="pl-4" />
                        <Separator />
                        <HeadersSection className="pl-4" />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem
                    value="transformation-configuration"
                    className="px-6"
                  >
                    <AccordionTrigger className="text-base text-foreground">
                      Request Options
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="flex flex-col gap-8 border-l">
                        <div className="flex flex-col gap-6 pl-4">
                          <div className="flex items-end justify-between gap-2">
                            <div className="space-y-1">
                              <h3 className="text-sm font-medium text-foreground">
                                Request Options Transform
                              </h3>
                              <p className="text-xs text-muted-foreground">
                                Configuration to transform the request before
                                sending it to the webhook
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className={cn(
                                'flex flex-row items-center gap-2 text-foreground',
                                {
                                  'border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive':
                                    isRequestOptionsSectionOpen,
                                },
                              )}
                              onClick={toggleRequestOptionsSectionOpen}
                            >
                              {isRequestOptionsSectionOpen ? (
                                <>
                                  <TrashIcon className="size-4" />
                                  <span>Remove Options Transform</span>
                                </>
                              ) : (
                                <>
                                  <PlusIcon className="size-4" />
                                  <span>Add Options Transform</span>
                                </>
                              )}
                            </Button>
                          </div>
                          {isRequestOptionsSectionOpen &&
                            isRequestOptionsTransformEnabled && (
                              <RequestOptionsSection className="pl-4" />
                            )}
                          {isRequestOptionsSectionOpen &&
                            isPayloadSectionOpen && <Separator />}
                          <div className="flex items-end justify-between gap-2">
                            <div className="space-y-1">
                              <h3 className="font-medium text-foreground">
                                Payload Transform
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                Adjust the request body.
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className={cn(
                                'flex flex-row items-center gap-2 text-foreground',
                                {
                                  'border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive':
                                    isPayloadSectionOpen,
                                },
                              )}
                              onClick={togglePayloadSectionOpen}
                            >
                              {isPayloadSectionOpen ? (
                                <>
                                  <TrashIcon className="size-4" />
                                  <span>Remove Payload Transform</span>
                                </>
                              ) : (
                                <>
                                  <PlusIcon className="size-4" />
                                  <span>Add Payload Transform</span>
                                </>
                              )}
                            </Button>
                          </div>
                          {isPayloadSectionOpen &&
                            isPayloadTransformEnabled && (
                              <PayloadTransformSection className="pl-4" />
                            )}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </form>
          </Form>
          <SheetFooter className="flex-shrink-0 border-t p-2">
            <div className="flex flex-1 flex-row items-start justify-between gap-2">
              <SheetClose asChild>
                <Button
                  variant="ghost"
                  className="text-foreground"
                  disabled={form.formState.isSubmitting}
                >
                  Cancel
                </Button>
              </SheetClose>
              <ButtonWithLoading
                type="submit"
                form="cron-trigger-form"
                loading={form.formState.isSubmitting}
                disabled={
                  form.formState.isSubmitting || !form.formState.isDirty
                }
              >
                {submitButtonText}
              </ButtonWithLoading>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <DiscardChangesDialog
        open={showUnsavedChangesDialog}
        onOpenChange={setShowUnsavedChangesDialog}
        onDiscardChanges={handleDiscardChanges}
      />
    </>
  );
}

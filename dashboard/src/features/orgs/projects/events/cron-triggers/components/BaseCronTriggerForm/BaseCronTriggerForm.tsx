import { DiscardChangesDialog } from '@/components/common/DiscardChangesDialog';
import { FormInput } from '@/components/form/FormInput';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/v3/accordion';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Checkbox } from '@/components/ui/v3/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
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
import { Switch } from '@/components/ui/v3/switch';
import { Textarea } from '@/components/ui/v3/textarea';
import { InfoTooltip } from '@/features/orgs/projects/common/components/InfoTooltip';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown } from 'lucide-react';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import {
  defaultFormValues,
  defaultPayloadTransformValues,
  defaultRequestOptionsTransformValues,
  frequentlyUsedCrons,
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
  const [isFrequentCronDropdownOpen, setIsFrequentCronDropdownOpen] =
    useState(false);

  const form = useForm<BaseCronTriggerFormValues>({
    resolver: zodResolver(validationSchema),
    defaultValues: initialData ?? defaultFormValues,
  });

  const { watch, reset, setValue } = form;
  const { isDirty } = form.formState;

  const sheetContentRef = useRef<HTMLDivElement | null>(null);

  const resetFormValues = useCallback(() => {
    reset(initialData ?? defaultFormValues);
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

  const isRequestOptionsTransformEnabled = !!watch('requestOptionsTransform');
  const isPayloadTransformEnabled = !!watch('payloadTransform');

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
          onPointerDownOutside={(e) => {
            let element: Element | null = e.target as Element;
            while (element) {
              const className =
                typeof element.className === 'string' ? element.className : '';
              const ariaLive = element.getAttribute('aria-live');

              if (
                ariaLive === 'polite' ||
                ariaLive === 'assertive' ||
                (className.includes('rounded-lg') &&
                  className.includes('text-white') &&
                  className.includes('max-w-xl'))
              ) {
                e.preventDefault();
                return;
              }
              element = element.parentElement;
            }
          }}
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
                    disabled={isEditing}
                    className="max-w-lg"
                    autoComplete="off"
                  />
                  <Separator />
                  <div className="flex flex-row items-center gap-2">
                    <h3 className="text-sm font-medium">
                      Webhook (HTTP/S) Handler{' '}
                    </h3>
                    <FormDescription>
                      <InfoTooltip>
                        Environment variables and secrets are available using
                        the {'{{VARIABLE}}'} tag.
                      </InfoTooltip>
                    </FormDescription>
                  </div>
                  <FormInput
                    control={form.control}
                    name="webhook"
                    label="Webhook URL or template"
                    placeholder="https://httpbin.org/post or {{MY_WEBHOOK_URL}}/handler"
                    className="max-w-lg text-foreground"
                  />
                  <FormField
                    name="payload"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex flex-row items-center gap-2">
                          <FormLabel className="text-foreground">
                            Payload
                          </FormLabel>
                          <FormDescription>
                            <InfoTooltip>
                              <p>
                                The request payload for the cron trigger, should
                                be a valid JSON
                              </p>
                            </InfoTooltip>
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Textarea
                            {...field}
                            id="payload"
                            className="min-h-[250px] max-w-lg font-mono text-foreground aria-[invalid=true]:border-destructive aria-[invalid=true]:focus:border-destructive aria-[invalid=true]:focus:ring-destructive/20"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex max-w-lg flex-row gap-2">
                    <FormInput
                      control={form.control}
                      name="schedule"
                      label="Schedule (Cron Expression)"
                      placeholder="0 0 * * *"
                      className="text-foreground"
                      infoTooltip="Schedule for your cron (events are created based on the UTC timezone)"
                    />
                    <DropdownMenu
                      open={isFrequentCronDropdownOpen}
                      onOpenChange={setIsFrequentCronDropdownOpen}
                    >
                      <DropdownMenuTrigger className="self-end" asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-10 whitespace-nowrap"
                        >
                          Freq. used crons
                          <ChevronDown className="ml-1.5 h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuPortal container={sheetContentRef.current}>
                        <DropdownMenuContent align="end" className="w-64">
                          {frequentlyUsedCrons.map((cron) => (
                            <DropdownMenuItem
                              key={cron.value}
                              className="flex flex-col items-start gap-1 py-2 hover:bg-accent hover:text-accent-foreground"
                              onSelect={(event) => {
                                event.preventDefault();
                                setValue('schedule', cron.value, {
                                  shouldDirty: true,
                                });
                                setIsFrequentCronDropdownOpen(false);
                              }}
                            >
                              <span className="text-sm font-medium">
                                {cron.label}
                              </span>
                              <span className="font-mono text-xs text-muted-foreground">
                                {cron.value}
                              </span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenuPortal>
                    </DropdownMenu>
                  </div>
                </div>
                <Separator />
                <Accordion
                  type="multiple"
                  value={openAccordionSections}
                  onValueChange={handleAccordionValueChange}
                >
                  <AccordionItem value="retry-configuration" className="px-6">
                    <AccordionTrigger className="text-base text-foreground">
                      Advanced settings
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="flex flex-col gap-8 border-l">
                        <RetryConfigurationSection className="pl-4" />

                        <Separator />
                        <div className="flex max-w-lg flex-col gap-6 pl-4 lg:flex-row lg:items-center">
                          <div className="space-y-2">
                            <h3 className="text-base font-medium text-foreground">
                              Include in Metadata
                            </h3>
                            <FormDescription>
                              If enabled, this cron trigger will be included in
                              the metadata of GraphQL
                            </FormDescription>
                          </div>
                          <FormField
                            control={form.control}
                            name="includeInMetadata"
                            render={({ field }) => (
                              <FormItem className="space-y-4">
                                <div className="flex flex-col gap-3">
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                </div>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
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
                      Configure Transformation
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="flex flex-col gap-8 border-l">
                        <div className="space-y-4 pl-4">
                          <div className="space-y-2">
                            <h3 className="text-sm font-medium text-foreground">
                              Enable Transformations
                            </h3>
                          </div>
                          <div className="flex flex-row items-center gap-8">
                            <FormItem className="flex w-auto flex-row items-center space-x-2 space-y-0">
                              <FormControl>
                                <Checkbox
                                  id="enable-request-transform"
                                  checked={isRequestOptionsTransformEnabled}
                                  onCheckedChange={(checked) => {
                                    const enabled = !!checked;
                                    setValue(
                                      'requestOptionsTransform',
                                      enabled
                                        ? defaultRequestOptionsTransformValues
                                        : undefined,
                                      { shouldDirty: true },
                                    );
                                  }}
                                />
                              </FormControl>
                              <FormLabel
                                htmlFor="enable-request-transform"
                                className="cursor-pointer font-normal text-foreground"
                              >
                                Request Options Transform
                              </FormLabel>
                            </FormItem>
                            <FormItem className="flex w-auto flex-row items-center space-x-2 space-y-0">
                              <FormControl>
                                <Checkbox
                                  id="enable-payload-transform"
                                  checked={isPayloadTransformEnabled}
                                  onCheckedChange={(checked) => {
                                    const enabled = !!checked;
                                    setValue(
                                      'payloadTransform',
                                      enabled
                                        ? defaultPayloadTransformValues
                                        : undefined,
                                      { shouldDirty: true },
                                    );
                                  }}
                                />
                              </FormControl>
                              <FormLabel
                                htmlFor="enable-payload-transform"
                                className="cursor-pointer font-normal text-foreground"
                              >
                                Payload Transform
                              </FormLabel>
                            </FormItem>
                          </div>
                        </div>
                        {(isRequestOptionsTransformEnabled ||
                          isPayloadTransformEnabled) && <Separator />}
                        {isRequestOptionsTransformEnabled && (
                          <RequestOptionsSection className="pl-4" />
                        )}
                        {isRequestOptionsTransformEnabled &&
                          isPayloadTransformEnabled && <Separator />}
                        {isPayloadTransformEnabled && (
                          <PayloadTransformSection className="pl-4" />
                        )}
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

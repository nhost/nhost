import { zodResolver } from '@hookform/resolvers/zod';
import { graphql } from 'cm6-graphql';
import { PlusIcon, TrashIcon, TriangleAlert } from 'lucide-react';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useForm } from 'react-hook-form';
import { DiscardChangesDialog } from '@/components/common/DiscardChangesDialog';
import { FormCodeEditor } from '@/components/form/FormCodeEditor';
import { FormInput } from '@/components/form/FormInput';
import { FormSelect } from '@/components/form/FormSelect';
import { FormTextarea } from '@/components/form/FormTextarea';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/v3/accordion';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Form } from '@/components/ui/v3/form';
import { SelectItem } from '@/components/ui/v3/select';
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
import { getOverlappingCustomTypenames } from '@/features/orgs/projects/actions/utils/buildActionDTO';
import { getActionSampleInputPayload } from '@/features/orgs/projects/actions/utils/getActionSampleInputPayload';
import { parseActionDefinitionSdl } from '@/features/orgs/projects/actions/utils/parseActionDefinitionSdl';
import { ForwardClientHeadersToggle } from '@/features/orgs/projects/common/components/ForwardClientHeadersToggle';
import { InfoTooltip } from '@/features/orgs/projects/common/components/InfoTooltip';
import { HeadersFormSection } from '@/features/orgs/projects/events/common/components/HeadersFormSection';
import { PayloadTransformFormSection } from '@/features/orgs/projects/events/common/components/PayloadTransformFormSection';
import { RequestOptionsFormSection } from '@/features/orgs/projects/events/common/components/RequestOptionsFormSection';
import { cn } from '@/lib/utils';
import type { CustomTypes } from '@/utils/hasura-api/generated/schemas';
import {
  actionKindOptions,
  type BaseActionFormInitialData,
  type BaseActionFormValues,
  defaultFormValues,
  defaultPayloadTransformValues,
  defaultRequestOptionsTransformValues,
  defaultResponseTransformValues,
  validationSchema,
} from './BaseActionFormTypes';

const ACCORDION_SECTION_VALUES = [
  'headers-configuration',
  'transformation-configuration',
] as const;

type AccordionSectionValue = (typeof ACCORDION_SECTION_VALUES)[number];

export interface BaseActionFormTriggerProps {
  open: () => void;
}

export interface BaseActionFormProps {
  initialData?: BaseActionFormInitialData;
  trigger?: (props: BaseActionFormTriggerProps) => ReactNode;
  onSubmit: (data: BaseActionFormValues) => void | Promise<void>;
  /**
   * Custom types currently present in the metadata. Used to warn about types
   * that would be overwritten when saving the action.
   */
  existingCustomTypes: CustomTypes;
  /**
   * Names of the custom types already used by the action being edited. These
   * are excluded from the overwrite warning.
   */
  originalActionTypenames?: string[];
  submitButtonText: string;
  titleText: string;
  descriptionText: string;
}

export default function BaseActionForm({
  initialData,
  trigger,
  onSubmit,
  existingCustomTypes,
  originalActionTypenames,
  titleText,
  descriptionText,
  submitButtonText,
}: BaseActionFormProps) {
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
  const [isResponseSectionOpen, setIsResponseSectionOpen] = useState(
    Boolean(initialData?.responseTransform),
  );

  const form = useForm<BaseActionFormValues>({
    resolver: zodResolver(validationSchema),
    defaultValues: initialData ?? defaultFormValues,
  });

  const { watch, reset, setValue } = form;
  const { isDirty } = form.formState;

  const sheetContentRef = useRef<HTMLDivElement | null>(null);

  const actionDefinitionSdl = watch('actionDefinitionSdl');
  const typesSdl = watch('typesSdl');

  const parsedActionType = useMemo(
    () =>
      parseActionDefinitionSdl(actionDefinitionSdl).definition?.type ??
      'mutation',
    [actionDefinitionSdl],
  );

  const isQueryAction = parsedActionType === 'query';

  useEffect(() => {
    if (isQueryAction) {
      setValue('kind', 'synchronous');
    }
  }, [isQueryAction, setValue]);

  const overlappingTypenames = useMemo(
    () =>
      getOverlappingCustomTypenames(
        typesSdl,
        existingCustomTypes,
        originalActionTypenames ?? [],
      ),
    [typesSdl, existingCustomTypes, originalActionTypenames],
  );

  const resetFormValues = useCallback(() => {
    reset(initialData ?? defaultFormValues);
    setIsRequestOptionsSectionOpen(
      Boolean(initialData?.requestOptionsTransform),
    );
    setIsPayloadSectionOpen(Boolean(initialData?.payloadTransform));
    setIsResponseSectionOpen(Boolean(initialData?.responseTransform));
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
  const isResponseTransformEnabled = Boolean(watch('responseTransform'));

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

  const toggleResponseSectionOpen = useCallback(() => {
    setIsResponseSectionOpen((prev) => {
      const next = !prev;

      if (next && !isResponseTransformEnabled) {
        setValue('responseTransform', defaultResponseTransformValues, {
          shouldDirty: true,
        });
      } else {
        setValue('responseTransform', undefined, { shouldDirty: true });
      }

      return next;
    });
  }, [isResponseTransformEnabled, setValue]);

  const handleResetSampleInput = useCallback(() => {
    const values = form.getValues();
    const { definition } = parseActionDefinitionSdl(values.actionDefinitionSdl);
    form.setValue(
      'payloadTransform.sampleInput',
      getActionSampleInputPayload(definition ?? undefined),
    );
  }, [form]);

  const handleDiscardChanges = () => {
    closeForm();
  };

  const triggerNode = trigger?.({ open: openForm }) ?? null;

  const handleAccordionValueChange = useCallback((value: string[]) => {
    setOpenAccordionSections(value as AccordionSectionValue[]);
  }, []);

  const handleSheetOpenAutoFocus = useCallback((event: Event) => {
    event.preventDefault();
    sheetContentRef.current?.focus();
  }, []);

  return (
    <>
      {triggerNode}
      <Sheet open={isSheetOpen} onOpenChange={handleSheetOpenChange}>
        <SheetContent
          ref={sheetContentRef}
          showOverlay
          tabIndex={-1}
          onOpenAutoFocus={handleSheetOpenAutoFocus}
          className="box flex w-xl flex-auto flex-col gap-0 p-0 sm:max-w-4xl md:w-4xl"
        >
          <SheetHeader className="p-6">
            <SheetTitle className="text-lg">{titleText}</SheetTitle>
            <SheetDescription>{descriptionText}</SheetDescription>
          </SheetHeader>
          <Separator />
          <Form {...form}>
            <form
              id="action-form"
              onSubmit={handleFormSubmit}
              className="flex flex-auto flex-col gap-4 overflow-y-auto pb-4"
            >
              <div className="flex flex-auto flex-col">
                <div className="flex flex-col gap-6 p-6 text-foreground">
                  <FormCodeEditor
                    control={form.control}
                    name="actionDefinitionSdl"
                    aria-label="Action Definition"
                    extensions={[graphql()]}
                    label={
                      <>
                        Action Definition{' '}
                        <InfoTooltip>
                          Define the action as a single field under a{' '}
                          <code>Mutation</code> or <code>Query</code> type.
                        </InfoTooltip>
                      </>
                    }
                  />
                  <FormCodeEditor
                    control={form.control}
                    name="typesSdl"
                    aria-label="Type Configuration"
                    extensions={[graphql()]}
                    label={
                      <>
                        Type Configuration{' '}
                        <InfoTooltip>
                          Define the new input and output types used by the
                          action.
                        </InfoTooltip>
                      </>
                    }
                  >
                    {overlappingTypenames.length > 0 && (
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                        <div className="flex items-start gap-2">
                          <TriangleAlert className="size-5 shrink-0 text-amber-500" />
                          <p className="text-pretty text-muted-foreground text-sm">
                            The following types already exist and will be
                            overwritten when saving:{' '}
                            <span className="font-medium text-foreground">
                              {overlappingTypenames.join(', ')}
                            </span>
                          </p>
                        </div>
                      </div>
                    )}
                  </FormCodeEditor>
                  <Separator />
                  <FormInput
                    control={form.control}
                    name="comment"
                    label="Comment"
                    placeholder="A statement to help describe the action in brief"
                    className="max-w-lg"
                    autoComplete="off"
                  />
                  <FormInput
                    control={form.control}
                    name="webhook"
                    placeholder="{{NHOST_FUNCTIONS_URL}}/my-handler or https://example.com/handler"
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
                  <FormSelect
                    control={form.control}
                    name="kind"
                    disabled={isQueryAction}
                    label={
                      <div className="flex flex-row items-center gap-2">
                        Kind{' '}
                        <InfoTooltip>
                          {isQueryAction
                            ? 'Query actions are always synchronous — only mutations can run asynchronously.'
                            : 'Asynchronous actions return an action id immediately and the response can be fetched later.'}
                        </InfoTooltip>
                      </div>
                    }
                    className="w-60 text-left text-foreground"
                  >
                    {actionKindOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </FormSelect>
                  <FormInput
                    control={form.control}
                    name="timeout"
                    type="number"
                    label={
                      <div className="flex flex-row items-center gap-2">
                        Timeout (seconds){' '}
                        <InfoTooltip>
                          Number of seconds to wait for the handler response
                          before timing out.
                        </InfoTooltip>
                      </div>
                    }
                    className="w-60 text-foreground"
                  />
                </div>
                <Separator />
                <Accordion
                  type="multiple"
                  value={openAccordionSections}
                  onValueChange={handleAccordionValueChange}
                >
                  <AccordionItem value="headers-configuration" className="px-6">
                    <AccordionTrigger className="text-base text-foreground">
                      Headers Settings
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="flex flex-col gap-8 border-l">
                        <div className="pl-4">
                          <ForwardClientHeadersToggle
                            control={form.control}
                            name="forwardClientHeaders"
                            label="Forward client headers to webhook"
                            tooltip="Toggle forwarding the headers sent by the client app in the request to your action handler."
                          />
                        </div>
                        <Separator />
                        <HeadersFormSection />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem
                    value="transformation-configuration"
                    className="px-6"
                  >
                    <AccordionTrigger className="text-base text-foreground">
                      Request & Response Options
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="flex flex-col gap-8 border-l">
                        <div className="flex flex-col gap-6 pl-4">
                          <div className="flex items-end justify-between gap-2">
                            <div className="space-y-1">
                              <h3 className="font-medium text-foreground text-sm">
                                Request Options Transform
                              </h3>
                              <p className="text-muted-foreground text-xs">
                                Configuration to transform the request before
                                sending it to the handler
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className={cn(
                                'flex min-w-[14rem] flex-row items-center gap-2 text-foreground',
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
                              <RequestOptionsFormSection />
                            )}
                          {isRequestOptionsSectionOpen &&
                            isPayloadSectionOpen && <Separator />}
                          <div className="flex items-end justify-between gap-2">
                            <div className="space-y-1">
                              <h3 className="font-medium text-foreground">
                                Payload Transform
                              </h3>
                              <p className="text-muted-foreground text-sm">
                                Adjust the request body.
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className={cn(
                                'flex min-w-[14rem] flex-row items-center gap-2 text-foreground',
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
                              <PayloadTransformFormSection
                                onResetSampleInput={handleResetSampleInput}
                              />
                            )}
                          {isResponseSectionOpen &&
                            (isRequestOptionsSectionOpen ||
                              isPayloadSectionOpen) && <Separator />}
                          <div className="flex items-end justify-between gap-2">
                            <div className="space-y-1">
                              <h3 className="font-medium text-foreground">
                                Response Transform
                              </h3>
                              <p className="text-muted-foreground text-sm">
                                Transform the handler response before returning
                                it to the client.
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className={cn(
                                'flex min-w-[14rem] flex-row items-center gap-2 text-foreground',
                                {
                                  'border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive':
                                    isResponseSectionOpen,
                                },
                              )}
                              onClick={toggleResponseSectionOpen}
                            >
                              {isResponseSectionOpen ? (
                                <>
                                  <TrashIcon className="size-4" />
                                  <span>Remove Response Transform</span>
                                </>
                              ) : (
                                <>
                                  <PlusIcon className="size-4" />
                                  <span>Add Response Transform</span>
                                </>
                              )}
                            </Button>
                          </div>
                          {isResponseSectionOpen &&
                            isResponseTransformEnabled && (
                              <FormTextarea
                                control={form.control}
                                name="responseTransform.template"
                                label={
                                  <div className="flex flex-row items-center gap-2 text-foreground">
                                    Response Body Transform Template
                                    <InfoTooltip>
                                      <p>
                                        The Kriti template that transforms the
                                        handler response into your action's
                                        output type.
                                      </p>
                                      <p>
                                        Use {'{{$body}}'} to access the original
                                        response body.
                                      </p>
                                    </InfoTooltip>
                                  </div>
                                }
                                className="min-h-[250px] max-w-lg font-mono text-foreground"
                              />
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
                form="action-form"
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

import { zodResolver } from '@hookform/resolvers/zod';
import { PlusIcon, TrashIcon } from 'lucide-react';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { DiscardChangesDialog } from '@/components/common/DiscardChangesDialog';
import { FormInput } from '@/components/form/FormInput';
import { FormSelect } from '@/components/form/FormSelect';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/v3/accordion';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Checkbox } from '@/components/ui/v3/checkbox';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/v3/radio-group';
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
import { InfoTooltip } from '@/features/orgs/projects/common/components/InfoTooltip';
import { useGetMetadata } from '@/features/orgs/projects/common/hooks/useGetMetadata';
import { useTableSchemaQuery } from '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery';
import { HeadersFormSection } from '@/features/orgs/projects/events/common/components/HeadersFormSection';
import { PayloadTransformFormSection } from '@/features/orgs/projects/events/common/components/PayloadTransformFormSection';
import { RequestOptionsFormSection } from '@/features/orgs/projects/events/common/components/RequestOptionsFormSection';
import { RetryConfigurationFormSection } from '@/features/orgs/projects/events/common/components/RetryConfigurationFormSection';
import { getSampleInputPayload } from '@/features/orgs/projects/events/event-triggers/utils/getSampleInputPayload';
import { cn } from '@/lib/utils';
import {
  ALL_TRIGGER_OPERATIONS,
  type BaseEventTriggerFormInitialData,
  type BaseEventTriggerFormValues,
  defaultFormValues,
  defaultPayloadTransformValues,
  defaultRequestOptionsTransformValues,
  updateTriggerOnOptions,
  validationSchema,
} from './BaseEventTriggerFormTypes';
import UpdateTriggerColumnsSection from './sections/UpdateTriggerColumnsSection';

const ACCORDION_SECTION_VALUES = [
  'retry-configuration',
  'transformation-configuration',
] as const;

type AccordionSectionValue = (typeof ACCORDION_SECTION_VALUES)[number];

export interface BaseEventTriggerFormTriggerProps {
  open: () => void;
}

export interface BaseEventTriggerFormProps {
  initialData?: BaseEventTriggerFormInitialData;
  trigger?: (props: BaseEventTriggerFormTriggerProps) => ReactNode;
  onSubmit: (data: BaseEventTriggerFormValues) => void | Promise<void>;
  isEditing?: boolean;
  submitButtonText: string;
  titleText: string;
  descriptionText: string;
}

export default function BaseEventTriggerForm({
  initialData,
  trigger,
  isEditing,
  onSubmit,
  titleText,
  descriptionText,
  submitButtonText,
}: BaseEventTriggerFormProps) {
  const { data: metadata } = useGetMetadata();
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

  const dataSources = metadata?.sources?.map((source) => source.name!) ?? [];

  const form = useForm<BaseEventTriggerFormValues>({
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

  const selectedDataSource = watch('dataSource');
  const selectedTableSchema = watch('tableSchema');
  const selectedTableName = watch('tableName');
  const selectedTriggerOperations = watch('triggerOperations');
  const selectedUpdateTriggerOn = watch('updateTriggerOn');

  const hasUpdateTrigger = selectedTriggerOperations.includes('update');

  const hasToChooseUpdateTriggerColumns = selectedUpdateTriggerOn === 'choose';

  const isRequestOptionsTransformEnabled = !!watch('requestOptionsTransform');
  const isPayloadTransformEnabled = !!watch('payloadTransform');

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

  const { data: selectedTableData } = useTableSchemaQuery(
    [`default.${selectedTableSchema}.${selectedTableName}`],
    {
      schema: selectedTableSchema,
      table: selectedTableName,
      queryOptions: {
        enabled: isSheetOpen && !!selectedTableSchema && !!selectedTableName,
      },
    },
  );

  const handleResetSampleInput = useCallback(() => {
    const values = form.getValues();
    setValue(
      'payloadTransform.sampleInput',
      getSampleInputPayload({
        formValues: values,
        columns: selectedTableData?.columns,
      }),
    );
  }, [form, setValue, selectedTableData?.columns]);

  const schemas = useMemo(() => {
    const databaseSchemas =
      metadata?.sources
        ?.find((source) => source.name === selectedDataSource)
        ?.tables?.map((table) => table.table.schema!) ?? [];
    const deduped = [...new Set(databaseSchemas)].sort();
    return deduped;
  }, [selectedDataSource, metadata]);

  const tables = useMemo(
    () =>
      metadata?.sources
        ?.find((source) => source.name === selectedDataSource)
        ?.tables?.filter((table) => table.table.schema === selectedTableSchema)
        ?.map((table) => table.table.name!) ?? [],
    [selectedDataSource, selectedTableSchema, metadata],
  );

  const handleDiscardChanges = () => {
    closeForm();
  };

  const triggerNode = trigger?.({ open: openForm }) ?? null;

  const handleAccordionValueChange = useCallback((value: string[]) => {
    setOpenAccordionSections(value as AccordionSectionValue[]);
  }, []);

  return (
    <>
      {triggerNode}
      <Sheet open={isSheetOpen} onOpenChange={handleSheetOpenChange}>
        <SheetContent
          showOverlay
          className="box flex w-xl flex-auto flex-col gap-0 p-0 sm:max-w-4xl md:w-4xl"
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
              id="event-trigger-form"
              onSubmit={handleFormSubmit}
              className="flex flex-auto flex-col gap-4 overflow-y-auto pb-4"
            >
              <div className="flex flex-auto flex-col">
                <div className="flex flex-col gap-6 p-6 text-foreground">
                  <FormInput
                    control={form.control}
                    name="triggerName"
                    label="Trigger Name"
                    placeholder="trigger_name"
                    disabled={isEditing}
                    className="max-w-lg"
                    autoComplete="off"
                  />
                  <div className="flex max-w-lg flex-row justify-between gap-6 lg:gap-20">
                    <FormSelect
                      control={form.control}
                      name="dataSource"
                      label="Data Source"
                      placeholder="Select"
                      disabled={isEditing}
                      className="min-w-[120px] max-w-60 text-foreground"
                    >
                      {dataSources?.map((dataSource) => (
                        <SelectItem key={dataSource} value={dataSource}>
                          {dataSource}
                        </SelectItem>
                      ))}
                    </FormSelect>
                    <div className="flex w-full flex-row items-center justify-start self-start">
                      <div className="w-auto self-start">
                        <FormSelect
                          control={form.control}
                          name="tableSchema"
                          label="Schema"
                          placeholder="Select"
                          disabled={!selectedDataSource || isEditing}
                          className="relative w-full min-w-[120px] max-w-32 rounded-r-none border-r-0 text-foreground focus:z-10"
                        >
                          {schemas?.map((tableSchema) => (
                            <SelectItem key={tableSchema} value={tableSchema}>
                              {tableSchema}
                            </SelectItem>
                          ))}
                        </FormSelect>
                      </div>
                      <div className="w-full self-start">
                        <FormSelect
                          control={form.control}
                          name="tableName"
                          label="Table"
                          placeholder="Select"
                          disabled={!selectedTableSchema || isEditing}
                          className="relative w-full min-w-[120px] max-w-72 rounded-l-none text-foreground focus:z-10"
                        >
                          {tables?.map((tableName) => (
                            <SelectItem key={tableName} value={tableName}>
                              {tableName}
                            </SelectItem>
                          ))}
                        </FormSelect>
                      </div>
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="flex flex-col gap-6 p-6">
                  <FormField
                    control={form.control}
                    name="triggerOperations"
                    render={({ field }) => (
                      <div className="flex flex-col gap-6">
                        <div className="space-y-2">
                          <h3 className="font-medium text-foreground text-sm">
                            Trigger Operations
                          </h3>
                          <FormDescription>
                            Trigger event on these table operations
                          </FormDescription>
                        </div>
                        <div className="flex flex-row items-center justify-start gap-8">
                          <FormDescription className="flex flex-row items-center gap-1">
                            On{' '}
                            <span className="font-mono">
                              {selectedTableName}
                            </span>
                            table:
                          </FormDescription>
                          {ALL_TRIGGER_OPERATIONS.map((operation) => (
                            <FormItem
                              key={operation}
                              className="flex w-auto flex-row items-center space-x-2 space-y-0"
                            >
                              <FormControl>
                                <Checkbox
                                  id={`trigger-operation-${operation}`}
                                  checked={field.value.includes(operation)}
                                  onCheckedChange={(checked) => {
                                    const newValue = checked
                                      ? [...field.value, operation]
                                      : field.value.filter(
                                          (value) => value !== operation,
                                        );
                                    field.onChange(newValue);
                                  }}
                                />
                              </FormControl>
                              <FormLabel
                                htmlFor={`trigger-operation-${operation}`}
                                className="cursor-pointer font-normal text-foreground"
                              >
                                {operation}
                              </FormLabel>
                            </FormItem>
                          ))}
                        </div>
                        <FormMessage />
                      </div>
                    )}
                  />
                  {hasUpdateTrigger && (
                    <>
                      <div className="flex flex-col gap-6">
                        <FormField
                          control={form.control}
                          name="updateTriggerOn"
                          render={({ field }) => (
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <h3 className="font-medium text-foreground text-sm">
                                  Trigger columns for update operation
                                </h3>
                                <FormDescription>
                                  For update triggers, webhook will be triggered
                                  only when selected columns are modified
                                </FormDescription>
                              </div>
                              <FormControl>
                                <RadioGroup
                                  name={field.name}
                                  value={field.value}
                                  onValueChange={field.onChange}
                                  className="flex flex-row items-center gap-12"
                                >
                                  {updateTriggerOnOptions.map(
                                    (updateTriggerOnValue) => (
                                      <FormItem
                                        key={updateTriggerOnValue}
                                        className="flex w-auto flex-row items-center space-x-2 space-y-0"
                                      >
                                        <FormControl>
                                          <RadioGroupItem
                                            value={updateTriggerOnValue}
                                            id={`update-trigger-on-${updateTriggerOnValue}`}
                                          />
                                        </FormControl>
                                        <FormLabel
                                          htmlFor={`update-trigger-on-${updateTriggerOnValue}`}
                                          className="cursor-pointer font-normal text-foreground"
                                        >
                                          {updateTriggerOnValue}
                                        </FormLabel>
                                      </FormItem>
                                    ),
                                  )}
                                </RadioGroup>
                              </FormControl>
                              <FormMessage />
                            </div>
                          )}
                        />
                      </div>
                      {hasToChooseUpdateTriggerColumns && (
                        <UpdateTriggerColumnsSection
                          isSheetOpen={isSheetOpen}
                        />
                      )}
                    </>
                  )}
                </div>
                <Separator />
                <div className="flex flex-col gap-6 px-6 py-6 text-foreground">
                  <div className="flex flex-row items-center gap-2">
                    <h3 className="font-medium text-sm">
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
                        <RetryConfigurationFormSection />
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
                      Configure Transformation
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
                              <RequestOptionsFormSection />
                            )}
                          {isRequestOptionsSectionOpen &&
                            isPayloadSectionOpen && <Separator />}
                          <div className="flex items-end justify-between gap-2">
                            <div className="space-y-1">
                              <h3 className="font-medium text-foreground text-sm">
                                Payload Transform
                              </h3>
                              <p className="text-muted-foreground text-xs">
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
                              <PayloadTransformFormSection
                                onResetSampleInput={handleResetSampleInput}
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
                form="event-trigger-form"
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

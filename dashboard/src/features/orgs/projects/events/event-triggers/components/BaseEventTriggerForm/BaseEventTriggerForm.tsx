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
import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import {
  ALL_TRIGGER_OPERATIONS,
  defaultFormValues,
  defaultPayloadTransformValues,
  defaultRequestOptionsTransformValues,
  updateTriggerOnOptions,
  validationSchema,
  type BaseEventTriggerFormInitialData,
  type BaseEventTriggerFormValues,
} from './BaseEventTriggerFormTypes';
import HeadersSection from './sections/HeadersSection';
import PayloadTransformSection from './sections/PayloadTransformSection/PayloadTransformSection';
import { RequestOptionsSection } from './sections/RequestOptionsSection';
import RetryConfigurationSection from './sections/RetryConfigurationSection';
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

  const dataSources = metadata?.sources?.map((source) => source.name!) ?? [];

  const form = useForm<BaseEventTriggerFormValues>({
    resolver: zodResolver(validationSchema),
    defaultValues: initialData ?? defaultFormValues,
  });

  const { watch, reset, setValue } = form;
  const { isDirty } = form.formState;

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

  const selectedDataSource = watch('dataSource');
  const selectedTableSchema = watch('tableSchema');
  const selectedTableName = watch('tableName');
  const selectedTriggerOperations = watch('triggerOperations');
  const selectedUpdateTriggerOn = watch('updateTriggerOn');

  const hasUpdateTrigger = selectedTriggerOperations.includes('update');

  const hasToChooseUpdateTriggerColumns = selectedUpdateTriggerOn === 'choose';

  const isRequestOptionsTransformEnabled = !!watch('requestOptionsTransform');
  const isPayloadTransformEnabled = !!watch('payloadTransform');

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
                          <h3 className="text-sm font-medium text-foreground">
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
                                <h3 className="text-sm font-medium text-foreground">
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
                        <UpdateTriggerColumnsSection />
                      )}
                    </>
                  )}
                </div>
                <Separator />
                <div className="flex flex-col gap-6 px-6 py-6 text-foreground">
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

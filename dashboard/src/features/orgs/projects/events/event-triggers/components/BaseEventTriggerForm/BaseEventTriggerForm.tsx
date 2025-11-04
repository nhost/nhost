import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/v3/accordion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/v3/alert-dialog';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Checkbox } from '@/components/ui/v3/checkbox';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from '@/components/ui/v3/field';
import { Input } from '@/components/ui/v3/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/v3/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { Separator } from '@/components/ui/v3/separator';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/v3/sheet-drawer';
import { IconTooltip } from '@/features/orgs/projects/common/components/IconTooltip';
import { TextWithTooltip } from '@/features/orgs/projects/common/components/TextWithTooltip';
import { useGetMetadata } from '@/features/orgs/projects/common/hooks/useGetMetadata';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import {
  ALL_TRIGGER_OPERATIONS,
  defaultFormValues,
  updateTriggerOnOptions,
  validationSchema,
  type BaseEventTriggerFormInitialData,
  type BaseEventTriggerFormValues,
} from './BaseEventTriggerFormTypes';
import HeadersSection from './sections/HeadersSection';
import RequestOptionsSection from './sections/RequestOptionsSection';
import RetryConfigurationSection from './sections/RetryConfigurationSection';
import UpdateTriggerColumnsSection from './sections/UpdateTriggerColumnsSection';

export interface BaseEventTriggerFormProps {
  initialData?: BaseEventTriggerFormInitialData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: BaseEventTriggerFormValues) => void;
  isEditing?: boolean;
  submitButtonText?: string;
  titleText?: string;
  descriptionText?: string;
}

export default function BaseEventTriggerForm({
  initialData,
  open,
  isEditing,
  onOpenChange,
  onSubmit,
  titleText = 'Create a New Event Trigger',
  descriptionText = "Enter the details to create your event trigger. Click Create when you're done.",
  submitButtonText = 'Save',
}: BaseEventTriggerFormProps) {
  const { data: metadata } = useGetMetadata();
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] =
    useState(false);

  const dataSources = metadata?.sources?.map((source) => source.name!) ?? [];

  console.log('initialData', initialData);

  const form = useForm<BaseEventTriggerFormValues>({
    resolver: zodResolver(validationSchema),
    defaultValues: initialData ?? defaultFormValues,
  });

  const { watch, reset } = form;

  useEffect(() => {
    if (initialData) {
      reset(initialData);
    }

    if (open && !initialData) {
      reset(defaultFormValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialData]);

  const selectedDataSource = watch('dataSource');
  const selectedTableSchema = watch('tableSchema');
  const selectedTableName = watch('tableName');
  const selectedTriggerOperations = watch('triggerOperations');
  const selectedUpdateTriggerOn = watch('updateTriggerOn');

  const hasUpdateTrigger = selectedTriggerOperations.includes('update');

  const hasToChooseUpdateTriggerColumns = selectedUpdateTriggerOn === 'choose';

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

  // const { errors } = form.formState;
  // console.log(errors);

  const handleOpenChange = (newOpen: boolean) => {
    // If trying to close the sheet and form has unsaved changes, show confirmation
    if (!newOpen && form.formState.isDirty) {
      setShowUnsavedChangesDialog(true);
    } else {
      onOpenChange(newOpen);
    }
  };

  const handleDiscardChanges = () => {
    setShowUnsavedChangesDialog(false);
    onOpenChange(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          className="w-xl md:w-4xl flex flex-auto flex-col gap-0 sm:max-w-4xl"
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
          <FormProvider {...form}>
            <form
              id="create-event-trigger-form"
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-auto flex-col gap-4 overflow-y-auto pt-7"
            >
              <FieldGroup className="flex flex-auto">
                <FieldSet className="px-6">
                  <Controller
                    name="triggerName"
                    control={form.control}
                    disabled={isEditing}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel
                          className="text-foreground"
                          htmlFor="triggerName"
                        >
                          Trigger Name
                        </FieldLabel>
                        <Input
                          {...field}
                          id="triggerName"
                          aria-invalid={fieldState.invalid}
                          placeholder="trigger_name"
                          className="max-w-lg text-foreground"
                          autoComplete="off"
                        />
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />
                  <FieldGroup className="flex max-w-lg flex-row justify-between gap-6 lg:gap-20">
                    <Controller
                      name="dataSource"
                      control={form.control}
                      disabled={isEditing}
                      render={({ field, fieldState }) => (
                        <Field
                          orientation="responsive"
                          data-invalid={fieldState.invalid}
                          className="flex w-auto"
                        >
                          <FieldContent className="flex flex-initial">
                            <FieldLabel
                              htmlFor="dataSource"
                              className="text-foreground"
                            >
                              Data Source
                            </FieldLabel>
                            {fieldState.invalid && (
                              <FieldError errors={[fieldState.error]} />
                            )}
                          </FieldContent>
                          <Select
                            name={field.name}
                            value={field.value}
                            disabled={isEditing}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger
                              id="dataSource"
                              aria-invalid={fieldState.invalid}
                              className="min-w-[120px] max-w-60 text-foreground"
                            >
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent position="item-aligned">
                              {dataSources?.map((dataSource) => (
                                <SelectItem key={dataSource} value={dataSource}>
                                  {dataSource}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                      )}
                    />
                    <div className="flex w-full flex-row items-center justify-start">
                      <Controller
                        name="tableSchema"
                        control={form.control}
                        disabled={isEditing}
                        render={({ field, fieldState }) => (
                          <Field
                            orientation="responsive"
                            data-invalid={fieldState.invalid}
                            className="w-auto"
                          >
                            <FieldContent>
                              <FieldLabel
                                htmlFor="tableSchema"
                                className="text-foreground"
                              >
                                Schema
                              </FieldLabel>
                              {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                              )}
                            </FieldContent>
                            <Select
                              name={field.name}
                              value={field.value}
                              onValueChange={field.onChange}
                              disabled={!selectedDataSource || isEditing}
                            >
                              <SelectTrigger
                                id="tableSchema"
                                aria-invalid={fieldState.invalid}
                                className="relative w-full min-w-[120px] max-w-32 rounded-r-none border-r-0 text-foreground focus:z-10"
                              >
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent position="item-aligned">
                                {schemas?.map((tableSchema) => (
                                  <SelectItem
                                    key={tableSchema}
                                    value={tableSchema}
                                  >
                                    {tableSchema}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>
                        )}
                      />
                      <Controller
                        name="tableName"
                        control={form.control}
                        disabled={isEditing}
                        render={({ field, fieldState }) => (
                          <Field
                            orientation="responsive"
                            data-invalid={fieldState.invalid}
                          >
                            <FieldContent>
                              <FieldLabel
                                htmlFor="tableName"
                                className="text-foreground"
                              >
                                Table
                              </FieldLabel>
                              {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                              )}
                            </FieldContent>
                            <Select
                              name={field.name}
                              value={field.value}
                              onValueChange={field.onChange}
                              disabled={!selectedTableSchema || isEditing}
                            >
                              <SelectTrigger
                                id="tableName"
                                aria-invalid={fieldState.invalid}
                                className="relative w-full min-w-[120px] max-w-72 rounded-l-none text-foreground focus:z-10"
                              >
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent position="item-aligned">
                                {tables?.map((tableName) => (
                                  <SelectItem key={tableName} value={tableName}>
                                    {tableName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>
                        )}
                      />
                    </div>
                  </FieldGroup>
                </FieldSet>
                <FieldSeparator />
                <Controller
                  name="triggerOperations"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <FieldSet
                      data-invalid={fieldState.invalid}
                      className="px-6"
                    >
                      <FieldLegend className="text-foreground">
                        Trigger Operations
                      </FieldLegend>
                      <FieldDescription>
                        Trigger event on these table operations
                      </FieldDescription>
                      <FieldGroup
                        data-slot="checkbox-group"
                        className="flex flex-row items-center justify-start !gap-8"
                      >
                        <FieldDescription className="flex flex-row items-center gap-1">
                          On{' '}
                          <TextWithTooltip
                            text={selectedTableName}
                            containerClassName="max-w-40"
                            className="font-mono"
                          />{' '}
                          table:
                        </FieldDescription>
                        {ALL_TRIGGER_OPERATIONS.map((operation) => (
                          <Field
                            key={operation}
                            orientation="horizontal"
                            data-invalid={fieldState.invalid}
                            className="w-auto"
                          >
                            <Checkbox
                              id={`trigger-operation-${operation}`}
                              name={field.name}
                              aria-invalid={fieldState.invalid}
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
                            <FieldLabel
                              htmlFor={`trigger-operation-${operation}`}
                              className="font-normal text-foreground"
                            >
                              {operation}
                            </FieldLabel>
                          </Field>
                        ))}
                      </FieldGroup>
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </FieldSet>
                  )}
                />
                {hasUpdateTrigger && (
                  <FieldGroup className="flex flex-col gap-2 px-6">
                    <Controller
                      name="updateTriggerOn"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <FieldSet data-invalid={fieldState.invalid}>
                          <FieldLegend
                            variant="label"
                            className="text-foreground"
                          >
                            Trigger columns for update operation
                          </FieldLegend>
                          <FieldDescription>
                            For update triggers, webhook will be triggered only
                            when selected columns are modified
                          </FieldDescription>
                          <RadioGroup
                            name={field.name}
                            value={field.value}
                            onValueChange={field.onChange}
                            aria-invalid={fieldState.invalid}
                            className="flex flex-row items-center gap-12"
                          >
                            {updateTriggerOnOptions.map(
                              (updateTriggerOnValue) => (
                                <Field
                                  key={updateTriggerOnValue}
                                  orientation="horizontal"
                                  data-invalid={fieldState.invalid}
                                  className="w-auto"
                                >
                                  <RadioGroupItem
                                    value={updateTriggerOnValue}
                                    id={`update-trigger-on-${updateTriggerOnValue}`}
                                    aria-invalid={fieldState.invalid}
                                  />
                                  <FieldLabel
                                    htmlFor={`update-trigger-on-${updateTriggerOnValue}`}
                                    className="font-normal text-foreground"
                                  >
                                    {updateTriggerOnValue}
                                  </FieldLabel>
                                </Field>
                              ),
                            )}
                          </RadioGroup>
                          {fieldState.invalid && (
                            <FieldError errors={[fieldState.error]} />
                          )}
                        </FieldSet>
                      )}
                    />

                    {hasToChooseUpdateTriggerColumns && (
                      <UpdateTriggerColumnsSection />
                    )}
                  </FieldGroup>
                )}
                <FieldSeparator />
                <Controller
                  name="webhook"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <FieldSet
                      data-invalid={fieldState.invalid}
                      className="px-6"
                    >
                      <FieldLegend className="flex flex-row items-center gap-2 text-foreground">
                        Webhook (HTTP/S) Handler{' '}
                        <FieldDescription>
                          <IconTooltip>
                            Environment variables and secrets are available
                            using the {'{{VARIABLE}}'} tag.
                          </IconTooltip>
                        </FieldDescription>
                      </FieldLegend>
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel
                          htmlFor="webhook"
                          className="text-foreground"
                        >
                          Webhook URL or template
                        </FieldLabel>
                        <Input
                          {...field}
                          id="webhook"
                          aria-invalid={fieldState.invalid}
                          placeholder="https://httpbin.org/post or {{MY_WEBHOOK_URL}}/handler"
                          className="max-w-lg text-foreground"
                        />
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    </FieldSet>
                  )}
                />
                <FieldSeparator />
                <Accordion type="multiple" className="">
                  <AccordionItem value="retry-configuration" className="px-6">
                    <AccordionTrigger className="pt-0 text-base text-foreground">
                      Retry and Headers Settings
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="flex flex-col gap-8 border-l">
                        <RetryConfigurationSection className="pl-4" />
                        <FieldSeparator />
                        <HeadersSection className="pl-4" />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem
                    value="configure-rest-connectors"
                    className="px-6"
                  >
                    <AccordionTrigger className="text-base text-foreground">
                      Configure REST Connectors
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="flex flex-col gap-8 border-l">
                        <RequestOptionsSection className="pl-4" />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </FieldGroup>
            </form>
          </FormProvider>
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
                form="create-event-trigger-form"
                loading={form.formState.isSubmitting || !form.formState.isDirty}
                disabled={form.formState.isSubmitting}
              >
                {submitButtonText}
              </ButtonWithLoading>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <AlertDialog
        open={showUnsavedChangesDialog}
        onOpenChange={setShowUnsavedChangesDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to discard them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDiscardChanges}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

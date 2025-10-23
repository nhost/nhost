import ErrorToast from '@/components/ui/v2/ErrorToast/ErrorToast';
import { Button } from '@/components/ui/v3/button';
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
import {
  TRIGGER_OPERATIONS,
  UPDATE_TRIGGER_ON,
} from '@/features/orgs/projects/events/event-triggers/constants';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { z } from 'zod';
import UpdateTriggerColumnsSection from './sections/UpdateTriggerColumnsSection';

export interface CreateEventTriggerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (data: z.infer<typeof formSchema>) => void;
}

const formSchema = z
  .object({
    triggerName: z
      .string()
      .min(1, { message: 'Trigger name is required' })
      .max(42, { message: 'Trigger name must be at most 42 characters' })
      .regex(/^[a-zA-Z0-9_-]+$/, {
        message:
          'Trigger name can only contain alphanumeric characters, underscores, and hyphens',
      }),
    dataSource: z.string({ required_error: 'Data source is required' }),
    tableName: z.string({ required_error: 'Table name is required' }),
    tableSchema: z.string({ required_error: 'Schema name is required' }),
    webhook: z.string().min(1, { message: 'Webhook is required' }),
    triggerOperations: z
      .array(z.enum(TRIGGER_OPERATIONS))
      .refine((value) => value.some((item) => item), {
        message: 'At least one trigger operation is required',
      }),
    updateTriggerOn: z.enum(UPDATE_TRIGGER_ON).optional(),
    updateTriggerColumns: z.array(z.string()),
    retryConf: z.object({
      numRetries: z.number().min(0),
      intervalSec: z.number().min(0),
      timeoutSec: z.number().min(0),
    }),
    headers: z.array(
      z
        .object({
          name: z.string().min(1),
          value: z.string().min(1).optional(),
          valueFromEnv: z.string().min(1).optional(),
        })
        .refine((item) => item.value || item.valueFromEnv, {
          message: 'Value is required',
        }),
    ),
  })
  .refine(
    (data) => {
      if (data.updateTriggerOn === 'choose') {
        return (data.updateTriggerColumns?.length ?? 0) > 0;
      }
      return true;
    },
    {
      message: 'At least one column is required for update trigger',
      path: ['updateTriggerColumns'],
    },
  );

export type CreateEventTriggerFormValues = z.infer<typeof formSchema>;

export default function CreateEventTriggerForm({
  open,
  onOpenChange,
}: CreateEventTriggerFormProps) {
  const { data: metadata } = useGetMetadata();

  const dataSources = metadata?.sources?.map((source) => source.name!) ?? [];

  const form = useForm<CreateEventTriggerFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      triggerName: '',
      dataSource: '',
      tableName: '',
      tableSchema: '',
      webhook: '',
      triggerOperations: ['insert'],
      updateTriggerOn: 'all',
      updateTriggerColumns: [],
      retryConf: {
        numRetries: 0,
        intervalSec: 10,
        timeoutSec: 60,
      },
      headers: [],
    },
  });

  const { watch } = form;
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

  const { errors } = form.formState;
  console.log(errors);

  function handleSubmit(data: CreateEventTriggerFormValues) {
    console.log(data);
    const errorToastId = toast.custom(
      (t) => (
        <ErrorToast
          isVisible={t.visible}
          errorMessage="Submitted form"
          error={data as unknown as Error}
          close={() => toast.dismiss(errorToastId)}
        />
      ),
      {
        duration: 1000,
      },
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-xl md:w-4xl flex flex-auto flex-col sm:max-w-4xl">
        <SheetHeader className="p-6">
          <SheetTitle className="text-lg">
            Create a New Event Trigger
          </SheetTitle>
          <SheetDescription>
            Enter the details to create your event trigger. Click Create when
            you&apos;re done.
          </SheetDescription>
        </SheetHeader>
        <FormProvider {...form}>
          <form
            id="create-event-trigger-form"
            onSubmit={form.handleSubmit(handleSubmit)}
            className="flex flex-auto flex-col gap-4"
          >
            <FieldGroup className="flex flex-auto">
              <FieldSet className="px-6">
                <Controller
                  name="triggerName"
                  control={form.control}
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
                <FieldGroup className="flex max-w-xl flex-row justify-between gap-2">
                  <Controller
                    name="dataSource"
                    control={form.control}
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
                  <div className="flex flex-row items-center justify-start">
                    <Controller
                      name="tableSchema"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Field
                          orientation="responsive"
                          data-invalid={fieldState.invalid}
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
                            disabled={!selectedDataSource}
                          >
                            <SelectTrigger
                              id="tableSchema"
                              aria-invalid={fieldState.invalid}
                              className="min-w-[120px] max-w-60 rounded-r-none border-r-0 text-foreground"
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
                            disabled={!selectedTableSchema}
                          >
                            <SelectTrigger
                              id="tableName"
                              aria-invalid={fieldState.invalid}
                              className="min-w-[120px] max-w-60 rounded-l-none text-foreground"
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
                  <FieldSet data-invalid={fieldState.invalid} className="px-6">
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
                      {TRIGGER_OPERATIONS.map((operation) => (
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
                          {UPDATE_TRIGGER_ON.map((updateTriggerOn) => (
                            <Field
                              key={updateTriggerOn}
                              orientation="horizontal"
                              data-invalid={fieldState.invalid}
                              className="w-auto"
                            >
                              <RadioGroupItem
                                value={updateTriggerOn}
                                id={`update-trigger-on-${updateTriggerOn}`}
                                aria-invalid={fieldState.invalid}
                              />
                              <FieldLabel
                                htmlFor={`update-trigger-on-${updateTriggerOn}`}
                                className="font-normal text-foreground"
                              >
                                {updateTriggerOn}
                              </FieldLabel>
                            </Field>
                          ))}
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
                    className="flex flex-auto px-6"
                  >
                    <FieldLegend className="flex flex-row items-center gap-2 text-foreground">
                      Webhook (HTTP/S) Handler{' '}
                      <FieldDescription>
                        <IconTooltip>
                          Environment variables and secrets are available using
                          the {'{{VARIABLE}}'} tag.
                        </IconTooltip>
                      </FieldDescription>
                    </FieldLegend>
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="webhook" className="text-foreground">
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
            </FieldGroup>
          </form>
        </FormProvider>
        <SheetFooter className="border-t p-2">
          <div className="flex flex-1 flex-row items-start justify-between gap-2">
            <SheetClose asChild>
              <Button variant="ghost" className="text-foreground">
                Cancel
              </Button>
            </SheetClose>
            <Button type="submit" form="create-event-trigger-form">
              Create
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

import { PostgreSQL, sql } from '@codemirror/lang-sql';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTheme } from '@mui/material';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import CodeMirror from '@uiw/react-codemirror';
import { Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Checkbox } from '@/components/ui/v3/checkbox';
import { Combobox } from '@/components/ui/v3/combobox';
import { CommandItem } from '@/components/ui/v3/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v3/dialog';
import { FreeCombobox } from '@/components/ui/v3/free-combobox';
import { Input } from '@/components/ui/v3/input';
import { Label } from '@/components/ui/v3/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { CreateLogicalModelForm } from '@/features/orgs/projects/database/native-queries/components/LogicalModelForms';
import TypedFieldRow from '@/features/orgs/projects/database/native-queries/components/TypedFieldRow';
import TypedFieldsSection from '@/features/orgs/projects/database/native-queries/components/TypedFieldsSection';
import type { NativeQueryFormValues } from '@/features/orgs/projects/database/native-queries/utils/buildNativeQueryTrackArgs';

export type { NativeQueryFormValues } from '@/features/orgs/projects/database/native-queries/utils/buildNativeQueryTrackArgs';

const POSTGRES_TYPES = [
  'bigint',
  'boolean',
  'date',
  'float8',
  'integer',
  'json',
  'jsonb',
  'numeric',
  'text',
  'timestamp',
  'timestamptz',
  'uuid',
] as const;

export const createNativeQueryFormSchema = (
  existingNames: string[],
  originalName?: string,
) =>
  z
    .object({
      source: z.string().trim().min(1, 'Select a data source.'),
      rootFieldName: z.string().trim().min(1, 'Root field name is required.'),
      description: z.string(),
      returns: z.string().trim().min(1, 'Select a return model.'),
      code: z.string().trim().min(1, 'SQL is required.'),
      arguments: z.array(
        z.object({
          name: z.string().trim().min(1, 'Argument name is required.'),
          type: z.string().trim().min(1, 'Select or enter an argument type.'),
          nullable: z.boolean(),
          description: z.string(),
        }),
      ),
    })
    .superRefine((values, context) => {
      if (
        values.rootFieldName !== originalName &&
        existingNames.includes(values.rootFieldName)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['rootFieldName'],
          message: 'A native query with this root field name already exists.',
        });
      }

      const names = new Set<string>();
      values.arguments.forEach((argument, index) => {
        if (names.has(argument.name)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['arguments', index, 'name'],
            message: 'Argument names must be unique.',
          });
        }
        names.add(argument.name);
      });
    });

const DEFAULT_VALUES: NativeQueryFormValues = {
  source: 'default',
  rootFieldName: '',
  description: '',
  returns: '',
  code: '',
  arguments: [],
};

interface NativeQueryFormProps {
  resetToken: string;
  values?: NativeQueryFormValues;
  existingNames: string[];
  originalName?: string;
  logicalModelNames: string[];
  sourceOptions: string[];
  sourceDisabled?: boolean;
  isPending: boolean;
  onSubmit: (values: NativeQueryFormValues) => Promise<void> | void;
  onCancel: VoidFunction;
}

export default function NativeQueryForm({
  resetToken,
  values = DEFAULT_VALUES,
  existingNames,
  originalName,
  logicalModelNames,
  sourceOptions,
  sourceDisabled = false,
  isPending,
  onSubmit,
  onCancel,
}: NativeQueryFormProps) {
  const theme = useTheme();
  const [returnsOpen, setReturnsOpen] = useState(false);
  const [dialogSource, setDialogSource] = useState<string | null>(null);
  const [localLogicalModelNames, setLocalLogicalModelNames] = useState<
    string[]
  >([]);
  const returnsTriggerRef = useRef<HTMLButtonElement>(null);
  const logicalModelDialogRef = useRef<HTMLDivElement>(null);
  const form = useForm<NativeQueryFormValues>({
    resolver: zodResolver(
      createNativeQueryFormSchema(existingNames, originalName),
    ),
    defaultValues: values,
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'arguments',
  });
  const { reset, setValue } = form;
  const availableLogicalModelNames = [
    ...new Set([...logicalModelNames, ...localLogicalModelNames]),
  ].sort((left, right) => left.localeCompare(right));

  // biome-ignore lint/correctness/useExhaustiveDependencies: resetToken intentionally forces a form reset.
  useEffect(() => {
    reset(values);
  }, [reset, resetToken, values]);

  return (
    <>
      <form
        className="box flex min-h-0 flex-auto flex-col content-between overflow-hidden border-t"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <div className="flex min-h-0 flex-auto flex-col overflow-hidden px-6 pt-4 pb-4">
          <div className="grid shrink-0 gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="native-query-source">Data Source</Label>
              <Controller
                control={form.control}
                name="source"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={sourceDisabled}
                  >
                    <SelectTrigger
                      id="native-query-source"
                      className="min-w-[120px] max-w-60"
                      aria-label="Data Source"
                    >
                      <SelectValue placeholder="Select a data source" />
                    </SelectTrigger>
                    <SelectContent>
                      {sourceOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.source && (
                <p className="text-destructive text-sm">
                  {form.formState.errors.source.message}
                </p>
              )}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="native-query-name">Root field name</Label>
              <Input
                id="native-query-name"
                placeholder="root_field_name"
                className="max-w-md"
                wrapperClassName="sm:max-w-[calc(50%-0.625rem)]"
                {...form.register('rootFieldName')}
              />
              {form.formState.errors.rootFieldName && (
                <p className="text-destructive text-sm">
                  {form.formState.errors.rootFieldName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="native-query-description">Description</Label>
              <Input
                id="native-query-description"
                placeholder="Optional native query description"
                className="max-w-md"
                {...form.register('description')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="native-query-returns">
                Returns logical model
              </Label>
              <Controller
                control={form.control}
                name="returns"
                render={({ field, fieldState }) => (
                  <Combobox
                    ref={returnsTriggerRef}
                    id="native-query-returns"
                    className="flex h-10 max-w-md"
                    aria-label="Returns logical model"
                    aria-invalid={fieldState.invalid}
                    aria-describedby={
                      fieldState.error
                        ? 'native-query-returns-error'
                        : undefined
                    }
                    value={field.value || null}
                    options={availableLogicalModelNames.map((name) => ({
                      value: name,
                      label: name,
                    }))}
                    placeholder="Select a logical model"
                    searchPlaceholder="Search logical models..."
                    emptyText="No logical models found."
                    open={returnsOpen}
                    onOpenChange={setReturnsOpen}
                    onBlur={field.onBlur}
                    onChange={field.onChange}
                    footerSlot={
                      <CommandItem
                        forceMount
                        value="__native-query-create-logical-model__"
                        className="rounded-none border-t px-3 py-2"
                        onSelect={() => {
                          setReturnsOpen(false);
                          setDialogSource(form.getValues('source'));
                        }}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Create logical model
                      </CommandItem>
                    }
                  />
                )}
              />
              {form.formState.errors.returns && (
                <p
                  id="native-query-returns-error"
                  className="text-destructive text-sm"
                >
                  {form.formState.errors.returns.message}
                </p>
              )}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>SQL</Label>
              <Controller
                control={form.control}
                name="code"
                render={({ field }) => (
                  <CodeMirror
                    aria-label="SQL"
                    value={field.value}
                    height="180px"
                    className="overflow-hidden rounded-md border"
                    theme={
                      theme.palette.mode === 'light' ? githubLight : githubDark
                    }
                    extensions={[sql({ dialect: PostgreSQL })]}
                    onChange={field.onChange}
                  />
                )}
              />
              {form.formState.errors.code && (
                <p className="text-destructive text-sm">
                  {form.formState.errors.code.message}
                </p>
              )}
            </div>
          </div>

          <TypedFieldsSection
            label="Arguments"
            addLabel="Add argument"
            layout="contained"
            error={
              form.formState.errors.arguments?.root?.message ??
              (typeof form.formState.errors.arguments?.message === 'string'
                ? form.formState.errors.arguments.message
                : undefined)
            }
            onAdd={() =>
              append({ name: '', type: '', nullable: false, description: '' })
            }
          >
            {fields.map((argument, index) => (
              <TypedFieldRow
                key={argument.id}
                noun="Argument"
                index={index}
                nameInputProps={{
                  ...form.register(`arguments.${index}.name`),
                  placeholder: 'Name',
                }}
                descriptionInputProps={form.register(
                  `arguments.${index}.description`,
                )}
                nameError={
                  form.formState.errors.arguments?.[index]?.name?.message
                }
                onRemove={() => remove(index)}
                typeEditor={
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Controller
                      control={form.control}
                      name={`arguments.${index}.type`}
                      render={({ field, fieldState }) => (
                        <div className="space-y-1">
                          <FreeCombobox
                            aria-label={`Argument ${index + 1} type`}
                            value={field.value || null}
                            options={POSTGRES_TYPES.map((type) => ({
                              label: type,
                              value: type,
                            }))}
                            placeholder="Select or enter a type"
                            searchPlaceholder="Search types..."
                            onChange={field.onChange}
                          />
                          {fieldState.error && (
                            <p className="text-destructive text-sm">
                              {fieldState.error.message}
                            </p>
                          )}
                        </div>
                      )}
                    />
                    <Controller
                      control={form.control}
                      name={`arguments.${index}.nullable`}
                      render={({ field }) => {
                        const id = `native-query-argument-${index + 1}-nullable`;

                        return (
                          <div className="flex items-center gap-2 text-sm">
                            <Checkbox
                              id={id}
                              checked={field.value}
                              onCheckedChange={(checked) =>
                                field.onChange(checked === true)
                              }
                            />
                            <label htmlFor={id}>Nullable</label>
                          </div>
                        );
                      }}
                    />
                  </div>
                }
              />
            ))}
          </TypedFieldsSection>
        </div>

        <div className="grid flex-shrink-0 grid-flow-col justify-between gap-3 border-t p-2">
          <Button
            type="button"
            variant="ghost"
            className="text-foreground"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <ButtonWithLoading type="submit" loading={isPending}>
            {originalName ? 'Save' : 'Create'}
          </ButtonWithLoading>
        </div>
      </form>

      <Dialog
        open={dialogSource !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDialogSource(null);
          }
        }}
      >
        <DialogContent
          ref={logicalModelDialogRef}
          className="flex max-h-[90vh] min-h-0 max-w-2xl flex-col overflow-hidden text-foreground"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            // Wait for the closing combobox focus scope before focusing the dialog.
            setTimeout(() => {
              logicalModelDialogRef.current
                ?.querySelector<HTMLInputElement>('#logical-model-name')
                ?.focus();
            }, 0);
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnsTriggerRef.current?.focus();
          }}
        >
          <DialogHeader className="shrink-0">
            <DialogTitle>Create logical model</DialogTitle>
            <DialogDescription>
              Create the return type for this native query.
            </DialogDescription>
          </DialogHeader>
          {dialogSource !== null && (
            <CreateLogicalModelForm
              logicalModelNames={availableLogicalModelNames}
              lockedSource={dialogSource}
              onCancel={() => setDialogSource(null)}
              onCreated={(name) => {
                setLocalLogicalModelNames((current) =>
                  current.includes(name) ? current : [...current, name],
                );
                setValue('returns', name, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
                setDialogSource(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

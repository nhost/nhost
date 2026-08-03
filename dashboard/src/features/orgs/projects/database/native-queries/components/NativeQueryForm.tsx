import { PostgreSQL, sql } from '@codemirror/lang-sql';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTheme } from '@mui/material';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import CodeMirror from '@uiw/react-codemirror';
import { Plus, Trash2 } from 'lucide-react';
import type { Ref } from 'react';
import { useEffect, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Checkbox } from '@/components/ui/v3/checkbox';
import { Combobox } from '@/components/ui/v3/combobox';
import { CommandItem } from '@/components/ui/v3/command';
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
      returns: z.string().trim().min(1, 'Select a return model.'),
      code: z.string().trim().min(1, 'SQL is required.'),
      arguments: z.array(
        z.object({
          name: z.string().trim().min(1, 'Argument name is required.'),
          type: z.string().trim().min(1, 'Select or enter an argument type.'),
          nullable: z.boolean(),
          description: z.string().optional(),
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
  returns: '',
  code: '',
  arguments: [],
};

interface ReturnModelSelection {
  name: string;
  revision: number;
}

interface NativeQueryFormProps {
  resetToken: string;
  values?: NativeQueryFormValues;
  existingNames: string[];
  originalName?: string;
  logicalModelNames: string[];
  sourceOptions: string[];
  sourceDisabled?: boolean;
  returnModelSelection?: ReturnModelSelection;
  isPending: boolean;
  onSubmit: (values: NativeQueryFormValues) => Promise<void> | void;
  onCancel: VoidFunction;
  onCreateLogicalModel?: (source: string) => void;
  returnsTriggerRef?: Ref<HTMLButtonElement>;
}

export default function NativeQueryForm({
  resetToken,
  values = DEFAULT_VALUES,
  existingNames,
  originalName,
  logicalModelNames,
  sourceOptions,
  sourceDisabled = false,
  returnModelSelection,
  isPending,
  onSubmit,
  onCancel,
  onCreateLogicalModel,
  returnsTriggerRef,
}: NativeQueryFormProps) {
  const theme = useTheme();
  const [returnsOpen, setReturnsOpen] = useState(false);
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: resetToken intentionally forces a form reset.
  useEffect(() => {
    reset(values);
  }, [reset, resetToken, values]);

  useEffect(() => {
    if (!returnModelSelection) {
      return;
    }

    setValue('returns', returnModelSelection.name, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }, [returnModelSelection, setValue]);

  return (
    <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
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

      <div className="space-y-2">
        <Label htmlFor="native-query-name">Root field name</Label>
        <Input
          id="native-query-name"
          placeholder="root_field_name"
          className="max-w-md"
          {...form.register('rootFieldName')}
        />
        {form.formState.errors.rootFieldName && (
          <p className="text-destructive text-sm">
            {form.formState.errors.rootFieldName.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="native-query-returns">Returns logical model</Label>
        <Controller
          control={form.control}
          name="returns"
          render={({ field, fieldState }) => (
            <Combobox
              ref={returnsTriggerRef}
              id="native-query-returns"
              className="flex max-w-md"
              aria-label="Returns logical model"
              aria-invalid={fieldState.invalid}
              aria-describedby={
                fieldState.error ? 'native-query-returns-error' : undefined
              }
              value={field.value || null}
              options={logicalModelNames.map((name) => ({
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
                onCreateLogicalModel ? (
                  <CommandItem
                    forceMount
                    value="__native-query-create-logical-model__"
                    className="rounded-none border-t px-3 py-2"
                    onSelect={() => {
                      setReturnsOpen(false);
                      onCreateLogicalModel(form.getValues('source'));
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create logical model
                  </CommandItem>
                ) : undefined
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

      <div className="space-y-2">
        <Label>SQL</Label>
        <Controller
          control={form.control}
          name="code"
          render={({ field }) => (
            <CodeMirror
              aria-label="SQL"
              value={field.value}
              minHeight="180px"
              className="overflow-hidden rounded-md border"
              theme={theme.palette.mode === 'light' ? githubLight : githubDark}
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

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Arguments</Label>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              append({ name: '', type: '', nullable: false, description: '' })
            }
          >
            <Plus className="mr-2 h-4 w-4" /> Add argument
          </Button>
        </div>
        {fields.map((argument, index) => (
          <div
            key={argument.id}
            className="grid gap-3 rounded-md bg-muted p-3 sm:grid-cols-2"
          >
            <div className="space-y-1">
              <Input
                aria-label={`Argument ${index + 1} name`}
                placeholder="Name"
                {...form.register(`arguments.${index}.name`)}
              />
              {form.formState.errors.arguments?.[index]?.name && (
                <p className="text-destructive text-sm">
                  {form.formState.errors.arguments[index]?.name?.message}
                </p>
              )}
            </div>
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
            <Input
              aria-label={`Argument ${index + 1} description`}
              placeholder="Description (optional)"
              {...form.register(`arguments.${index}.description`)}
            />
            <div className="flex items-center justify-between">
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
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove argument ${index + 1}`}
                onClick={() => remove(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <ButtonWithLoading type="submit" loading={isPending}>
          Save native query
        </ButtonWithLoading>
      </div>
    </form>
  );
}

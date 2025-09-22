import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { Button } from '@/components/ui/v3/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import { Input } from '@/components/ui/v3/input';
import { Popover, PopoverTrigger } from '@/components/ui/v3/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { Spinner } from '@/components/ui/v3/spinner';
import { useIntrospectRemoteSchemaQuery } from '@/features/orgs/projects/remote-schemas/hooks/useIntrospectRemoteSchemaQuery';
import getSourceTypes from '@/features/orgs/projects/remote-schemas/utils/getSourceTypes';
import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { Anchor, ChevronsUpDown } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import FieldToColumnMapSelector from './FieldToColumnMapSelector';
import SourceTypeCombobox from './SourceTypeCombobox';
import TargetTableCombobox from './TargetTableCombobox';

export interface DatabaseRelationshipFormProps {
  sourceSchema: string;
  onSubmit: (values: DatabaseRelationshipFormValues) => void;
  submitButtonText?: string;
  onCancel?: () => void;
  defaultValues?: DatabaseRelationshipFormValues;
  disabled?: boolean;
  /**
   * Whether the name input should be disabled.
   */
  nameInputDisabled?: boolean;
}

export type DatabaseRelationshipFormValues = z.infer<typeof formSchema>;

const formSchema = z.object({
  name: z.string().min(1, { message: 'Name is required' }),
  sourceRemoteSchema: z
    .string()
    .min(1, { message: 'Source remote schema is required' }),
  sourceType: z.string().min(1, { message: 'Source type is required' }),
  table: z
    .object({
      name: z.string().min(1, { message: 'Table name is required' }),
      schema: z.string().min(1, { message: 'Table schema is required' }),
    })
    .refine((value) => Boolean(value?.name) && Boolean(value?.schema), {
      message: 'Target table is required',
    }),
  relationshipType: z.enum(['array', 'object']),
  fieldMapping: z.array(
    z.object({
      sourceField: z.string().min(1, { message: 'Source field is required' }),
      referenceColumn: z
        .string()
        .min(1, { message: 'Reference column is required' }),
    }),
  ),
});

export default function DatabaseRelationshipForm({
  sourceSchema,
  onSubmit,
  submitButtonText,
  onCancel,
  defaultValues,
  disabled,
  nameInputDisabled,
}: DatabaseRelationshipFormProps) {
  const form = useForm<DatabaseRelationshipFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: defaultValues?.name || '',
      sourceRemoteSchema: defaultValues?.sourceRemoteSchema || sourceSchema,
      sourceType: defaultValues?.sourceType || '',
      relationshipType: defaultValues?.relationshipType || 'array',
      table: {
        name: defaultValues?.table?.name || '',
        schema: defaultValues?.table?.schema || '',
      },
      fieldMapping: defaultValues?.fieldMapping || [
        { sourceField: '', referenceColumn: '' },
      ],
    },
  });

  const { isSubmitting } = form.formState;

  const { data: introspectionData } = useIntrospectRemoteSchemaQuery(
    sourceSchema,
    {
      queryOptions: {
        enabled: !!sourceSchema,
      },
    },
  );

  const sourceTypes = getSourceTypes(introspectionData);

  function handleSubmit(values: z.infer<typeof formSchema>) {
    return onSubmit(values);
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="flex flex-1 flex-col gap-4"
      >
        <div className="flex flex-col gap-4 px-6">
          <h4 className="text-xl font-medium tracking-tight">Source</h4>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex flex-row items-center gap-2">
                  Relationship name
                  <Tooltip title="This will be used as the field name in the source type.">
                    <InfoIcon
                      aria-label="Info"
                      className="h-4 w-4"
                      color="primary"
                    />
                  </Tooltip>
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="Relationship name"
                    className={cn({
                      'border-destructive': form.formState.errors.name,
                    })}
                    {...field}
                    disabled={disabled || nameInputDisabled}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex flex-row gap-4">
            <FormField
              control={form.control}
              name="sourceRemoteSchema"
              render={({ field }) => (
                <FormItem className="flex flex-1 flex-col">
                  <FormLabel>Source Remote Schema</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          disabled
                          variant="outline"
                          role="combobox"
                          className={cn(
                            'w-full justify-between',
                            !field.value && 'text-muted-foreground',
                          )}
                        >
                          {sourceSchema}
                          <ChevronsUpDown className="opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <SourceTypeCombobox sourceTypes={sourceTypes} disabled={disabled} />
          </div>
        </div>
        <div className="flex flex-row items-center justify-center gap-2 border-b-1 border-t-1 border-muted-foreground/20 py-4">
          <Anchor className="h-4 w-4" />
          <h4 className="text-xl font-medium tracking-tight">Type Mapped To</h4>
        </div>
        <div className="flex flex-col gap-4 px-6">
          <TargetTableCombobox disabled={disabled} />
          <FormField
            control={form.control}
            name="relationshipType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  disabled={disabled}
                >
                  <FormControl>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Select a type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="array">Array Relationship</SelectItem>
                    <SelectItem value="object">Object Relationship</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FieldToColumnMapSelector
          sourceSchema={sourceSchema}
          disabled={disabled}
        />

        <div className="mt-auto flex justify-between gap-2 border-t-1 border-foreground/20 px-6 pt-4">
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || disabled}>
            {isSubmitting ? <Spinner /> : submitButtonText}
          </Button>
        </div>
      </form>
    </Form>
  );
}

import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { Button } from '@/components/ui/v3/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/v3/command';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import { Input } from '@/components/ui/v3/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useGetRemoteSchemasQuery } from '@/features/orgs/projects/remote-schemas/hooks/useGetRemoteSchemasQuery';
import { useIntrospectRemoteSchemaQuery } from '@/features/orgs/projects/remote-schemas/hooks/useIntrospectRemoteSchemaQuery';
import convertIntrospectionToSchema from '@/features/orgs/projects/remote-schemas/utils/convertIntrospectionToSchema';
import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { isObjectType } from 'graphql';
import { Anchor, Check, ChevronsUpDown } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import SchemaToArgumentMapSelector from './SchemaToArgumentMapSelector';

export interface RemoteSchemaRelationshipFormProps {
  sourceSchema: string;
  onSubmit: (values: RemoteSchemaRelationshipFormValues) => void;
  onCancel?: () => void;
  submitButtonText?: string;
  defaultValues?: RemoteSchemaRelationshipFormValues;
  disabled?: boolean;
}

export type RemoteSchemaRelationshipFormValues = z.infer<typeof formSchema>;

const formSchema = z.object({
  name: z.string().min(1, { message: 'Relationship name is required' }),
  sourceRemoteSchema: z
    .string()
    .min(1, { message: 'Source remote schema is required' }),

  targetRemoteSchema: z
    .string()
    .min(1, { message: 'Target remote schema is required' }),
  targetField: z.string().min(1, { message: 'Target field is required' }),
  sourceType: z.string().min(1, { message: 'Source type is required' }),
  mappings: z.array(
    z.object({
      argument: z.string().min(1, { message: 'Argument is required' }),
      type: z.enum(['sourceTypeField', 'staticValue']),
      value: z.string().min(1, { message: 'Value is required' }),
    }),
  ),
});

export default function RemoteSchemaRelationshipForm({
  sourceSchema,
  onSubmit,
  submitButtonText,
  onCancel,
  defaultValues,
  disabled,
}: RemoteSchemaRelationshipFormProps) {
  const { project } = useProject();
  const form = useForm<RemoteSchemaRelationshipFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: defaultValues?.name || '',
      sourceRemoteSchema: defaultValues?.sourceRemoteSchema || sourceSchema,
      targetRemoteSchema: defaultValues?.targetRemoteSchema || '',
      sourceType: defaultValues?.sourceType || '',
      targetField: defaultValues?.targetField || '',
      mappings: defaultValues?.mappings || [],
    },
  });

  // Fetch all remote schemas for the target schema dropdown
  const { data: remoteSchemas, status: remoteSchemasQueryStatus } =
    useGetRemoteSchemasQuery(['remote_schemas', project?.subdomain]);

  // Introspect the source remote schema to get its types
  const { data: sourceIntrospectionData } = useIntrospectRemoteSchemaQuery(
    sourceSchema,
    {
      queryOptions: {
        enabled: !!sourceSchema,
      },
    },
  );

  // Watch the selected target remote schema
  const targetRemoteSchemaValue = form.watch('targetRemoteSchema');

  // Introspect the target remote schema to get its fields
  const { data: targetIntrospectionData } = useIntrospectRemoteSchemaQuery(
    targetRemoteSchemaValue,
    {
      queryOptions: {
        enabled: !!targetRemoteSchemaValue,
      },
    },
  );

  // Convert introspection to GraphQL schema and extract object types
  const sourceTypes = sourceIntrospectionData
    ? (() => {
        const schema = convertIntrospectionToSchema(sourceIntrospectionData);
        if (!schema) {
          return [];
        }
        const typeMap = schema.getTypeMap();

        return Object.values(typeMap)
          .filter(isObjectType)
          .filter((type) => !type.name.startsWith('__')) // Filter out introspection types
          .map((type) => ({
            label: type.name,
            value: type.name,
          }));
      })()
    : [];

  // Convert target introspection to GraphQL schema and extract fields for the selected target field
  const targetFields = targetIntrospectionData
    ? (() => {
        const schema = convertIntrospectionToSchema(targetIntrospectionData);
        if (!schema) {
          return [];
        }

        // const typeMap = schema.getTypeMap();
        const queryType = schema.getQueryType();

        if (!queryType) {
          return [];
        }

        const fields = queryType.getFields();

        return Object.keys(fields).map((fieldName) => ({
          label: fieldName,
          value: fieldName,
        }));
      })()
    : [];

  function handleSubmit(values: z.infer<typeof formSchema>) {
    onSubmit(values);
  }

  if (remoteSchemasQueryStatus === 'loading' || !remoteSchemas) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading remote schemas..."
        className="justify-center"
      />
    );
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
                    {...field}
                    disabled={disabled}
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
            <FormField
              control={form.control}
              name="sourceType"
              render={({ field }) => (
                <FormItem className="flex flex-1 flex-col">
                  <FormLabel>Source Type</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          disabled={disabled}
                          role="combobox"
                          className={cn(
                            'w-full justify-between',
                            !field.value && 'text-muted-foreground',
                          )}
                        >
                          {field.value
                            ? sourceTypes.find(
                                (type) => type.value === field.value,
                              )?.label
                            : 'Select type'}
                          <ChevronsUpDown className="opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] p-0">
                      <Command>
                        <CommandInput
                          placeholder="Search source type..."
                          className="h-9"
                        />
                        <CommandList>
                          <CommandEmpty>No source type found.</CommandEmpty>
                          <CommandGroup>
                            {sourceTypes.map((type) => (
                              <CommandItem
                                value={type.label}
                                key={type.value}
                                onSelect={() => {
                                  form.setValue('sourceType', type.value);
                                }}
                              >
                                {type.label}
                                <Check
                                  className={cn(
                                    'ml-auto',
                                    type.value === field.value
                                      ? 'opacity-100'
                                      : 'opacity-0',
                                  )}
                                />
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
        <div className="flex flex-row items-center justify-center gap-2 border-b-1 border-t-1 border-muted-foreground/20 py-4">
          <Anchor className="h-4 w-4" />
          <h4 className="text-xl font-medium tracking-tight">Type Mapped To</h4>
        </div>
        <div className="flex flex-col gap-4 px-6">
          <div className="flex flex-row gap-4">
            <FormField
              control={form.control}
              name="targetRemoteSchema"
              render={({ field }) => (
                <FormItem className="flex flex-1 flex-col">
                  <FormLabel>Target Remote Schema</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          disabled={disabled}
                          variant="outline"
                          role="combobox"
                          className={cn(
                            'w-full justify-between',
                            !field.value && 'text-muted-foreground',
                          )}
                        >
                          {field.value
                            ? remoteSchemas.find(
                                (schema) => schema.name === field.value,
                              )?.name
                            : 'Select remote schema'}
                          <ChevronsUpDown className="opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] p-0">
                      <Command>
                        <CommandInput
                          placeholder="Search remote schema..."
                          className="h-9"
                        />
                        <CommandList>
                          <CommandEmpty>No remote schema found.</CommandEmpty>
                          <CommandGroup>
                            {remoteSchemas.map((schema) => (
                              <CommandItem
                                value={schema.name}
                                key={schema.name}
                                onSelect={() => {
                                  form.setValue(
                                    'targetRemoteSchema',
                                    schema.name,
                                  );
                                }}
                              >
                                {schema.name}
                                <Check
                                  className={cn(
                                    'ml-auto',
                                    schema.name === field.value
                                      ? 'opacity-100'
                                      : 'opacity-0',
                                  )}
                                />
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="targetField"
              render={({ field }) => (
                <FormItem className="flex flex-1 flex-col">
                  <FormLabel>Target Remote Schema Field</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          disabled={disabled}
                          role="combobox"
                          className={cn(
                            'w-full justify-between',
                            !field.value && 'text-muted-foreground',
                          )}
                        >
                          {field.value
                            ? targetFields.find(
                                (fieldItem) => fieldItem.value === field.value,
                              )?.label
                            : 'Select field'}
                          <ChevronsUpDown className="opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] p-0">
                      <Command>
                        <CommandInput
                          placeholder="Search target field..."
                          className="h-9"
                        />
                        <CommandList>
                          <CommandEmpty>No target field found.</CommandEmpty>
                          <CommandGroup>
                            {targetFields.map((fieldItem) => (
                              <CommandItem
                                value={fieldItem.label}
                                key={fieldItem.value}
                                onSelect={() => {
                                  form.setValue('targetField', fieldItem.value);
                                }}
                              >
                                {fieldItem.label}
                                <Check
                                  className={cn(
                                    'ml-auto',
                                    fieldItem.value === field.value
                                      ? 'opacity-100'
                                      : 'opacity-0',
                                  )}
                                />
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <SchemaToArgumentMapSelector sourceSchema={sourceSchema} />
        </div>
        <div className="mt-auto flex justify-between gap-2 border-t-1 border-foreground/20 px-6 pt-4">
          <Button
            type="button"
            variant="outline"
            disabled={form.formState.isSubmitting}
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={form.formState.isSubmitting || disabled}
          >
            {submitButtonText}
          </Button>
        </div>
      </form>
    </Form>
  );
}

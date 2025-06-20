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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { convertIntrospectionToSchema } from '@/features/orgs/projects/remote-schemas/components/RemoteSchemaPreview/utils';
import { useGetRemoteSchemasQuery } from '@/features/orgs/projects/remote-schemas/hooks/useGetRemoteSchemasQuery';
import { useIntrospectRemoteSchemaQuery } from '@/features/orgs/projects/remote-schemas/hooks/useIntrospectRemoteSchemaQuery';
import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { isObjectType } from 'graphql';
import { Anchor, Check, ChevronsUpDown } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import FieldToColumnMapSelector from './FieldToColumnMapSelector';
import TargetTableCombobox from './TargetTableCombobox';

export interface DatabaseRelationshipFormProps {
  sourceSchema: string;
  onSubmit: (values: DatabaseRelationshipFormValues) => void;
}

export type DatabaseRelationshipFormValues = z.infer<typeof formSchema>;

const formSchema = z.object({
  name: z.string().min(1, { message: 'Name is required' }),
  sourceRemoteSchema: z
    .string()
    .min(1, { message: 'Source remote schema is required' }),
  sourceType: z.string().min(1, { message: 'Source type is required' }),
  table: z.object({
    name: z.string().min(1, { message: 'Table name is required' }),
    schema: z.string().min(1, { message: 'Table schema is required' }),
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
}: DatabaseRelationshipFormProps) {
  const form = useForm<DatabaseRelationshipFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      sourceRemoteSchema: '', // get from remote schema
      sourceType: '',
      relationshipType: 'array',
      table: {
        name: '',
        schema: '',
      },
      fieldMapping: [],
    },
  });

  // Get all remote schemas
  const { data: remoteSchemas = [] } = useGetRemoteSchemasQuery(
    ['remote-schemas'],
    {
      queryOptions: { enabled: true },
    },
  );

  // Watch the selected remote schema
  const selectedRemoteSchema = form.watch('sourceRemoteSchema');

  // Introspect the selected remote schema to get its types
  const { data: introspectionData } = useIntrospectRemoteSchemaQuery(
    selectedRemoteSchema,
    {
      queryOptions: {
        enabled: !!selectedRemoteSchema,
      },
    },
  );

  // Convert introspection to GraphQL schema and extract object types
  const sourceTypes = introspectionData
    ? (() => {
        const schema = convertIntrospectionToSchema(introspectionData);
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

  console.log(sourceTypes);

  function handleSubmit(values: z.infer<typeof formSchema>) {
    console.log(values);
    // onSubmit(values);
  }
  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="flex flex-col gap-4"
      >
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
                <Input placeholder="Relationship name" {...field} />
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
                  {/* <PopoverContent className="max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] p-0">
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
                                  'sourceRemoteSchema',
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
                  </PopoverContent> */}
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
        <div className="flex flex-row items-center justify-center gap-2 border-t-1 border-t-muted-foreground/20 pt-4">
          <Anchor className="h-4 w-4" />
          <h4 className="text-xl font-medium tracking-tight">Type Mapped To</h4>
        </div>

        <TargetTableCombobox />
        <FormField
          control={form.control}
          name="relationshipType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select a verified email to display" />
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
        <FieldToColumnMapSelector />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            Create Relationship
          </Button>
        </div>
      </form>
    </Form>
  );
}

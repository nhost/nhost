import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
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
import { Spinner } from '@/components/ui/v3/spinner';
import { useGetRemoteSchemas } from '@/features/orgs/projects/remote-schemas/hooks/useGetRemoteSchemas';
import { useIntrospectRemoteSchemaQuery } from '@/features/orgs/projects/remote-schemas/hooks/useIntrospectRemoteSchemaQuery';
import getQueryTypeFields from '@/features/orgs/projects/remote-schemas/utils/getQueryTypeFields';
import getSourceTypes from '@/features/orgs/projects/remote-schemas/utils/getSourceTypes';
import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { Anchor, ChevronsUpDown } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import SchemaToArgumentMapSelector from './SchemaToArgumentMapSelector';
import SourceTypeCombobox from './SourceTypeCombobox';
import TargetRemoteSchemaCombobox from './TargetRemoteSchemaCombobox';
import TargetRemoteSchemaFieldCombobox from './TargetRemoteSchemaFieldCombobox';

export interface RemoteSchemaRelationshipFormProps {
  sourceSchema: string;
  onSubmit: (values: RemoteSchemaRelationshipFormValues) => void;
  onCancel?: () => void;
  submitButtonText?: string;
  defaultValues?: RemoteSchemaRelationshipFormValues;
  disabled?: boolean;
  /**
   * Whether the name input should be disabled.
   */
  nameInputDisabled?: boolean;
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
  nameInputDisabled,
}: RemoteSchemaRelationshipFormProps) {
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

  const { isSubmitting } = form.formState;

  const { data: remoteSchemas, status: remoteSchemasQueryStatus } =
    useGetRemoteSchemas();

  const { data: sourceIntrospectionData } = useIntrospectRemoteSchemaQuery(
    sourceSchema,
    {
      queryOptions: {
        enabled: !!sourceSchema,
      },
    },
  );

  const targetRemoteSchemaValue = form.watch('targetRemoteSchema');

  const { data: targetIntrospectionData } = useIntrospectRemoteSchemaQuery(
    targetRemoteSchemaValue,
    {
      queryOptions: {
        enabled: !!targetRemoteSchemaValue,
      },
    },
  );

  const sourceTypes = getSourceTypes(sourceIntrospectionData);

  const targetFields = getQueryTypeFields(targetIntrospectionData);

  function handleSubmit(values: z.infer<typeof formSchema>) {
    return onSubmit(values);
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
          <div className="flex flex-row gap-4">
            <TargetRemoteSchemaCombobox
              disabled={disabled}
              remoteSchemas={remoteSchemas}
            />
            <TargetRemoteSchemaFieldCombobox
              disabled={disabled}
              targetFields={targetFields}
            />
          </div>
          <SchemaToArgumentMapSelector
            sourceSchema={sourceSchema}
            disabled={disabled}
          />
        </div>
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

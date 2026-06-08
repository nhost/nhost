import { useFormContext } from 'react-hook-form';
import { Combobox } from '@/components/ui/v3/combobox';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import type { RemoteSchemaInfo } from '@/utils/hasura-api/generated/schemas';
import type { RemoteSchemaRelationshipFormValues } from './RemoteSchemaRelationshipForm';

export interface TargetRemoteSchemaComboboxProps {
  remoteSchemas: RemoteSchemaInfo[];
}

export default function TargetRemoteSchemaCombobox({
  remoteSchemas,
}: TargetRemoteSchemaComboboxProps) {
  const form = useFormContext<RemoteSchemaRelationshipFormValues>();

  const options = remoteSchemas.map((schema) => ({
    label: schema.name,
    value: schema.name,
  }));

  return (
    <FormField
      control={form.control}
      name="targetRemoteSchema"
      render={({ field }) => (
        <FormItem className="flex flex-1 flex-col">
          <FormLabel>Target Remote Schema</FormLabel>
          <FormControl>
            <Combobox
              options={options}
              value={field.value}
              onChange={(value) => {
                form.setValue('targetRemoteSchema', value, {
                  shouldValidate: true,
                  shouldDirty: true,
                  shouldTouch: true,
                });
              }}
              onBlur={field.onBlur}
              placeholder="Select remote schema"
              searchPlaceholder="Search remote schema..."
              emptyText="No remote schema found."
              className={
                form.formState.errors.targetRemoteSchema
                  ? 'border-destructive'
                  : ''
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

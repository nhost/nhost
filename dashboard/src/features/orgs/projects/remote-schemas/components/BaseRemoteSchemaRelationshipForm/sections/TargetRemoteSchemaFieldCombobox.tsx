import { useFormContext } from 'react-hook-form';
import { Combobox } from '@/components/ui/v3/combobox';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import type { RemoteSchemaRelationshipFormValues } from './RemoteSchemaRelationshipForm';

export interface TargetRemoteSchemaFieldComboboxProps {
  targetFields: { label: string; value: string }[];
}

export default function TargetRemoteSchemaFieldCombobox({
  targetFields,
}: TargetRemoteSchemaFieldComboboxProps) {
  const form = useFormContext<RemoteSchemaRelationshipFormValues>();

  return (
    <FormField
      control={form.control}
      name="targetField"
      render={({ field }) => (
        <FormItem className="flex flex-1 flex-col">
          <FormLabel>Target Remote Schema Field</FormLabel>
          <FormControl>
            <Combobox
              options={targetFields}
              value={field.value}
              onChange={(value) => {
                form.setValue('targetField', value, {
                  shouldValidate: true,
                  shouldDirty: true,
                  shouldTouch: true,
                });
              }}
              onBlur={field.onBlur}
              placeholder="Select field"
              searchPlaceholder="Search target field..."
              emptyText="No target field found."
              className={
                form.formState.errors.targetField ? 'border-destructive' : ''
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

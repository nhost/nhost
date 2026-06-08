import { useFormContext } from 'react-hook-form';
import { Combobox } from '@/components/ui/v3/combobox';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import type { DatabaseRelationshipFormValues } from './DatabaseRelationshipForm';
import type { RemoteSchemaRelationshipFormValues } from './RemoteSchemaRelationshipForm';

export interface SourceTypeComboboxProps {
  sourceTypes: { label: string; value: string }[];
}

export default function SourceTypeCombobox({
  sourceTypes,
}: SourceTypeComboboxProps) {
  const form = useFormContext<
    DatabaseRelationshipFormValues | RemoteSchemaRelationshipFormValues
  >();

  return (
    <FormField
      control={form.control}
      name="sourceType"
      render={({ field }) => (
        <FormItem className="flex flex-1 flex-col">
          <FormLabel>Source Type</FormLabel>
          <FormControl>
            <Combobox
              options={sourceTypes}
              value={field.value}
              onChange={(value) => {
                form.setValue('sourceType', value, {
                  shouldValidate: true,
                  shouldDirty: true,
                  shouldTouch: true,
                });
              }}
              onBlur={field.onBlur}
              placeholder="Select type"
              searchPlaceholder="Search source type..."
              emptyText="No source type found."
              className={
                form.formState.errors.sourceType ? 'border-destructive' : ''
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

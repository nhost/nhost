import { Controller, type UseFormReturn } from 'react-hook-form';
import { Checkbox } from '@/components/ui/v3/checkbox';
import { FreeCombobox } from '@/components/ui/v3/free-combobox';
import { postgresTypeOptions } from '@/features/orgs/projects/database/native-queries/components/BaseNativeQueryForm/BaseNativeQueryFormTypes';
import { TypedFieldRow } from '@/features/orgs/projects/database/native-queries/components/TypedFieldRow';
import { TypedFieldsSection } from '@/features/orgs/projects/database/native-queries/components/TypedFieldsSection';
import type { NativeQueryFormValues } from '@/features/orgs/projects/database/native-queries/utils/buildNativeQueryDTO';

export interface NativeQueryArgumentsSectionProps {
  form: UseFormReturn<NativeQueryFormValues>;
  fields: { id: string }[];
  watchedArguments: NativeQueryFormValues['arguments'];
  onAdd: VoidFunction;
  onRemove: (index: number) => void;
}

export default function NativeQueryArgumentsSection({
  form,
  fields,
  watchedArguments,
  onAdd,
  onRemove,
}: NativeQueryArgumentsSectionProps) {
  return (
    <TypedFieldsSection variant="argument" onAdd={onAdd}>
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
          descriptionValue={watchedArguments[index]?.description}
          nameError={form.formState.errors.arguments?.[index]?.name?.message}
          onRemove={() => onRemove(index)}
          typeEditor={
            <>
              <Controller
                control={form.control}
                name={`arguments.${index}.type`}
                render={({ field, fieldState }) => {
                  const errorId = `native-query-argument-${index + 1}-type-error`;

                  return (
                    <div className="min-w-0 space-y-1">
                      <FreeCombobox
                        aria-label={`Argument ${index + 1} type`}
                        aria-invalid={fieldState.invalid}
                        className="h-10"
                        aria-describedby={
                          fieldState.error ? errorId : undefined
                        }
                        value={field.value || null}
                        options={postgresTypeOptions}
                        placeholder="Select or enter a type"
                        searchPlaceholder="Search types..."
                        onChange={field.onChange}
                      />
                      {fieldState.error && (
                        <p id={errorId} className="text-destructive text-sm">
                          {fieldState.error.message}
                        </p>
                      )}
                    </div>
                  );
                }}
              />
              <Controller
                control={form.control}
                name={`arguments.${index}.nullable`}
                render={({ field }) => {
                  const id = `native-query-argument-${index + 1}-nullable`;

                  return (
                    <div className="flex h-10 items-center justify-center">
                      <Checkbox
                        id={id}
                        aria-label={`Argument ${index + 1} nullable`}
                        checked={field.value}
                        onCheckedChange={(checked) =>
                          field.onChange(checked === true)
                        }
                      />
                    </div>
                  );
                }}
              />
            </>
          }
        />
      ))}
    </TypedFieldsSection>
  );
}

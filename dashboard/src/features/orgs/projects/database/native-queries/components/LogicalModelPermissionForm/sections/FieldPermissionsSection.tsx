import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/v3/button';
import { Checkbox } from '@/components/ui/v3/checkbox';
import { Label } from '@/components/ui/v3/label';
import type { LogicalModelPermissionFormValues } from '@/features/orgs/projects/database/native-queries/components/LogicalModelPermissionForm/LogicalModelPermissionForm';
import type { LogicalModelItem } from '@/utils/hasura-api/generated/schemas';
import PermissionSettingsSection from './PermissionSettingsSection';

export interface FieldPermissionsSectionProps {
  model: LogicalModelItem;
}

export default function FieldPermissionsSection({
  model,
}: FieldPermissionsSectionProps) {
  const { control, setValue } =
    useFormContext<LogicalModelPermissionFormValues>();
  const selectedColumns = useWatch({ name: 'columns' }) as string[];
  const isAllFieldsSelected =
    model.fields.length > 0 &&
    model.fields.every(({ name }) => selectedColumns.includes(name));

  function handleToggleAll() {
    if (isAllFieldsSelected) {
      setValue('columns', [], { shouldDirty: true });
      return;
    }

    setValue(
      'columns',
      model.fields.map(({ name }) => name),
      { shouldDirty: true },
    );
  }

  return (
    <PermissionSettingsSection title="Fields select permissions">
      <div className="grid grid-flow-col items-center justify-between gap-2">
        <p>Select the logical model fields this role can access.</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-primary"
          onClick={handleToggleAll}
        >
          {isAllFieldsSelected ? 'Deselect All' : 'Select All'}
        </Button>
      </div>
      <Controller
        control={control}
        name="columns"
        render={({ field }) => (
          <div className="grid gap-3 sm:grid-cols-2">
            {model.fields.map((modelField) => {
              const checked = field.value.includes(modelField.name);
              const id = `logical-model-field-${modelField.name}`;
              return (
                <div key={modelField.name} className="flex items-center gap-2">
                  <Checkbox
                    id={id}
                    checked={checked}
                    onCheckedChange={(next) => {
                      field.onChange(
                        next
                          ? [...field.value, modelField.name]
                          : field.value.filter(
                              (name) => name !== modelField.name,
                            ),
                      );
                    }}
                  />
                  <Label htmlFor={id}>{modelField.name}</Label>
                </div>
              );
            })}
          </div>
        )}
      />
    </PermissionSettingsSection>
  );
}

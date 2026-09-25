import { useFormContext, useWatch } from 'react-hook-form';
import { HighlightedText } from '@/components/presentational/HighlightedText';
import { Label } from '@/components/ui/v3/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/v3/radio-group';
import {
  LogicalModelCustomCheckEditor,
  LogicalModelCustomCheckEditorProvider,
  LogicalModelCustomCheckModeToggle,
} from '@/features/orgs/projects/database/native-queries/components/LogicalModelCustomCheckEditor';
import type { LogicalModelPermissionFormValues } from '@/features/orgs/projects/database/native-queries/components/LogicalModelPermissionForm/LogicalModelPermissionForm';
import type { LogicalModelFieldDescriptor } from '@/features/orgs/projects/database/native-queries/utils/logicalModelPermissionFilter';
import PermissionSettingsSection from './PermissionSettingsSection';

export interface RowPermissionsSectionProps {
  role: string;
  fields: LogicalModelFieldDescriptor[];
}

export default function RowPermissionsSection({
  role,
  fields,
}: RowPermissionsSectionProps) {
  const { setValue } = useFormContext<LogicalModelPermissionFormValues>();
  const rowCheckType = useWatch<
    LogicalModelPermissionFormValues,
    'rowCheckType'
  >({ name: 'rowCheckType' });

  function handleCheckTypeChange(
    value: LogicalModelPermissionFormValues['rowCheckType'],
  ) {
    setValue('rowCheckType', value, { shouldDirty: true });
  }

  return (
    <PermissionSettingsSection title="Row select permissions">
      <LogicalModelCustomCheckEditorProvider defaultMode="builder">
        <p>
          Allow role <HighlightedText>{role}</HighlightedText> to{' '}
          <HighlightedText>select</HighlightedText> rows:
        </p>
        <div className="flex items-center justify-between gap-4">
          <RadioGroup
            value={rowCheckType}
            className="grid grid-flow-col justify-start gap-4"
            onValueChange={(value) =>
              handleCheckTypeChange(
                value as LogicalModelPermissionFormValues['rowCheckType'],
              )
            }
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem
                id="logical-model-row-none"
                value="none"
                className="cursor-pointer"
              />
              <Label
                htmlFor="logical-model-row-none"
                className="cursor-pointer"
              >
                Without any checks
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem
                id="logical-model-row-custom"
                value="custom"
                className="cursor-pointer"
              />
              <Label
                htmlFor="logical-model-row-custom"
                className="cursor-pointer"
              >
                With custom check
              </Label>
            </div>
          </RadioGroup>
          {rowCheckType === 'custom' ? (
            <LogicalModelCustomCheckModeToggle />
          ) : null}
        </div>
        {rowCheckType === 'custom' ? (
          <LogicalModelCustomCheckEditor name="filter" fields={fields} />
        ) : null}
      </LogicalModelCustomCheckEditorProvider>
    </PermissionSettingsSection>
  );
}

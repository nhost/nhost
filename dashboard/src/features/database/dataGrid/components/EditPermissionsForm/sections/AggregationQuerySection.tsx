import { ControlledSwitch } from '@/components/form/ControlledSwitch';
import { HighlightedText } from '@/components/presentational/HighlightedText';
import { Text } from '@/components/ui/v2/Text';
import type { RolePermissionEditorFormValues } from '@/features/database/dataGrid/components/EditPermissionsForm/RolePermissionEditorForm';
import { useFormContext } from 'react-hook-form';
import PermissionSettingsSection from './PermissionSettingsSection';

export interface AggregationQuerySectionProps {
  /**
   * The role that is being edited.
   */
  role: string;
  /**
   * Determines whether or not the section is disabled.
   */
  disabled?: boolean;
}

export default function AggregationQuerySection({
  role,
  disabled,
}: AggregationQuerySectionProps) {
  const { setValue, getValues } =
    useFormContext<RolePermissionEditorFormValues>();

  return (
    <PermissionSettingsSection title="Aggregation queries permissions">
      <Text variant="subtitle1">
        Allow queries with aggregate functions like sum, count, avg, max, min,
        etc.
      </Text>

      <ControlledSwitch
        disabled={disabled}
        name="allowAggregations"
        label={
          <Text variant="subtitle1" component="span">
            Allow <HighlightedText>{role}</HighlightedText> to make aggregation
            queries
          </Text>
        }
        onChange={(event) => {
          if (event.target.checked) {
            return;
          }

          setValue(
            'queryRootFields',
            getValues('queryRootFields')?.filter(
              (field) => field !== 'select_aggregate',
            ) || [],
          );

          setValue(
            'subscriptionRootFields',
            getValues('subscriptionRootFields')?.filter(
              (field) => field !== 'select_aggregate',
            ) || [],
          );
        }}
      />
    </PermissionSettingsSection>
  );
}

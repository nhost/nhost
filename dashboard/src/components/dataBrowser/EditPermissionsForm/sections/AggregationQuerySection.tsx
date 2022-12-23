import ControlledSwitch from '@/components/common/ControlledSwitch';
import HighlightedText from '@/components/common/HighlightedText';
import type { RolePermissionEditorFormValues } from '@/components/dataBrowser/EditPermissionsForm/RolePermissionEditorForm';
import Text from '@/ui/v2/Text';
import { useFormContext } from 'react-hook-form';
import PermissionSettingsSection from './PermissionSettingsSection';

export interface AggregationQuerySectionProps {
  /**
   * The role that is being edited.
   */
  role: string;
}

export default function AggregationQuerySection({
  role,
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
        }}
      />
    </PermissionSettingsSection>
  );
}

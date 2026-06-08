import { Controller, useFormContext } from 'react-hook-form';
import { HighlightedText } from '@/components/presentational/HighlightedText';
import { Label } from '@/components/ui/v3/label';
import { Switch } from '@/components/ui/v3/switch';
import type { RolePermissionEditorFormValues } from '@/features/orgs/projects/database/dataGrid/components/EditPermissionsForm/RolePermissionEditorForm';
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
  const { control, setValue } =
    useFormContext<RolePermissionEditorFormValues>();

  return (
    <PermissionSettingsSection title="Aggregation queries permissions">
      <p className="text-muted-foreground">
        Allow queries with aggregate functions like sum, count, avg, max, min,
        etc.
      </p>

      <Controller
        control={control}
        name="allowAggregations"
        render={({ field }) => (
          <div className="flex items-center gap-2">
            <Switch
              id="allowAggregations"
              checked={field.value}
              onCheckedChange={(checked) => {
                field.onChange(checked);

                if (checked) {
                  return;
                }

                setValue('queryRootFields.select_aggregate', false);
                setValue('subscriptionRootFields.select_aggregate', false);
              }}
            />
            <Label
              htmlFor="allowAggregations"
              className="font-normal text-muted-foreground"
            >
              Allow <HighlightedText>{role}</HighlightedText> to make
              aggregation queries
            </Label>
          </div>
        )}
      />
    </PermissionSettingsSection>
  );
}

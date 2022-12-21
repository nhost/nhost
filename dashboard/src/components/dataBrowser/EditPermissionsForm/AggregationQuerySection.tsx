import ControlledSwitch from '@/components/common/ControlledSwitch';
import HighlightedText from '@/components/common/HighlightedText';
import Text from '@/ui/v2/Text';
import { useFormContext } from 'react-hook-form';
import type { RolePermissionEditorFormValues } from './RolePermissionEditorForm';

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
    <section className="bg-white border-y-1 border-gray-200">
      <Text
        component="h2"
        className="px-6 py-3 font-bold border-b-1 border-gray-200"
      >
        Aggregation queries permissions
      </Text>

      <div className="grid grid-flow-row gap-4 items-center px-6 py-4">
        <Text variant="subtitle1">
          Allow queries with aggregate functions like sum, count, avg, max, min,
          etc.
        </Text>

        <ControlledSwitch
          name="allowAggregations"
          label={
            <Text variant="subtitle1" component="span">
              Allow <HighlightedText>{role}</HighlightedText> to make
              aggregation queries
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
      </div>
    </section>
  );
}

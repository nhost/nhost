import ControlledSwitch from '@/components/common/ControlledSwitch';
import Button from '@/ui/v2/Button';
import Checkbox from '@/ui/v2/Checkbox';
import Text from '@/ui/v2/Text';
import { useFormContext, useWatch } from 'react-hook-form';
import PermissionSettingsSection from './PermissionSettingsSection';
import type { RolePermissionEditorFormValues } from './RolePermissionEditorForm';

export default function RootFieldPermissionsSection() {
  const { register, setValue } =
    useFormContext<RolePermissionEditorFormValues>();
  const allowAggregations = useWatch({
    name: 'allowAggregations',
  }) as boolean;
  const enableRootFieldCustomization = useWatch({
    name: 'enableRootFieldCustomization',
  }) as boolean;
  const checkedQueryRootFields = useWatch({
    name: 'queryRootFields',
  }) as string[];
  const checkedSubscriptionRootFields = useWatch({
    name: 'subscriptionRootFields',
  }) as string[];

  const numberOfAvailableQueryRootFields = allowAggregations ? 3 : 2;
  const availableQueryRootFields = allowAggregations
    ? checkedQueryRootFields
    : checkedQueryRootFields.filter((field) => field !== 'select_aggregate');

  const numberOfAvailableSubscriptionRootFields = allowAggregations ? 3 : 2;
  const availableSubscriptionRootFields = allowAggregations
    ? checkedSubscriptionRootFields
    : checkedSubscriptionRootFields.filter(
        (field) => field !== 'select_aggregate',
      );

  function toggleQueryRootFields() {
    if (availableQueryRootFields.length === numberOfAvailableQueryRootFields) {
      setValue('queryRootFields', []);

      return;
    }

    if (!allowAggregations) {
      setValue('queryRootFields', ['select', 'select_by_pk']);

      return;
    }

    setValue('queryRootFields', ['select', 'select_by_pk', 'select_aggregate']);
  }

  function toggleSubscriptionRootFields() {
    if (
      availableSubscriptionRootFields.length ===
      numberOfAvailableSubscriptionRootFields
    ) {
      setValue('subscriptionRootFields', []);

      return;
    }

    if (!allowAggregations) {
      setValue('subscriptionRootFields', ['select', 'select_by_pk']);

      return;
    }

    setValue('subscriptionRootFields', [
      'select',
      'select_by_pk',
      'select_aggregate',
    ]);
  }

  return (
    <PermissionSettingsSection title="Root fields permissions">
      <Text variant="subtitle1">
        By enabling this you can customize the root field permissions. When this
        switch is turned off, all values are enabled by default.
      </Text>

      <ControlledSwitch
        name="enableRootFieldCustomization"
        label={
          <Text variant="subtitle1" component="span">
            Enable GraphQL root field visibility customization
          </Text>
        }
        onChange={(event) => {
          if (!event.target.checked) {
            setValue('queryRootFields', []);
            setValue('subscriptionRootFields', []);

            return;
          }

          if (!allowAggregations) {
            setValue('queryRootFields', ['select', 'select_by_pk']);
            setValue('subscriptionRootFields', ['select', 'select_by_pk']);

            return;
          }

          setValue('queryRootFields', [
            'select',
            'select_by_pk',
            'select_aggregate',
          ]);
          setValue('subscriptionRootFields', [
            'select',
            'select_by_pk',
            'select_aggregate',
          ]);
        }}
      />

      {enableRootFieldCustomization && (
        <div className="grid grid-flow-row gap-4">
          <div className="grid grid-flow-row gap-2">
            <div className="grid grid-flow-row items-center sm:grid-flow-col gap-2 justify-center sm:justify-between">
              <Text>
                Allow the following root fields under the{' '}
                <strong>query root field</strong>:
              </Text>

              <Button
                variant="borderless"
                size="small"
                onClick={toggleQueryRootFields}
              >
                {availableQueryRootFields.length ===
                numberOfAvailableQueryRootFields
                  ? 'Deselect All'
                  : 'Select All'}
              </Button>
            </div>

            <div className="flex flex-row flex-wrap gap-6 justify-start">
              <Checkbox
                name="queryRootFields"
                value="select"
                label="select"
                checked={availableQueryRootFields.includes('select')}
                {...register('queryRootFields')}
              />
              <Checkbox
                name="queryRootFields"
                value="select_by_pk"
                label="select_by_pk"
                checked={availableQueryRootFields.includes('select_by_pk')}
                {...register('queryRootFields')}
              />
              <Checkbox
                name="queryRootFields"
                value="select_aggregate"
                disabled={!allowAggregations}
                label="select_aggregate"
                checked={
                  allowAggregations
                    ? availableQueryRootFields.includes('select_aggregate')
                    : false
                }
                {...register('queryRootFields')}
              />
            </div>
          </div>

          <div className="grid grid-flow-row gap-2">
            <div className="grid grid-flow-row items-center sm:grid-flow-col gap-2 justify-center sm:justify-between">
              <Text>
                Allow the following root fields under the{' '}
                <strong>subscription root field</strong>:
              </Text>

              <Button
                variant="borderless"
                size="small"
                onClick={toggleSubscriptionRootFields}
              >
                {availableSubscriptionRootFields.length ===
                numberOfAvailableSubscriptionRootFields
                  ? 'Deselect All'
                  : 'Select All'}
              </Button>
            </div>

            <div className="flex flex-row flex-wrap gap-6 justify-start">
              <Checkbox
                name="subscriptionRootFields"
                value="select"
                label="select"
                checked={availableSubscriptionRootFields.includes('select')}
                {...register('subscriptionRootFields')}
              />
              <Checkbox
                name="subscriptionRootFields"
                value="select_by_pk"
                label="select_by_pk"
                checked={availableSubscriptionRootFields.includes(
                  'select_by_pk',
                )}
                {...register('subscriptionRootFields')}
              />
              <Checkbox
                name="subscriptionRootFields"
                value="select_aggregate"
                disabled={!allowAggregations}
                label="select_aggregate"
                checked={
                  allowAggregations
                    ? availableSubscriptionRootFields.includes(
                        'select_aggregate',
                      )
                    : false
                }
                {...register('subscriptionRootFields')}
              />
            </div>
          </div>
        </div>
      )}
    </PermissionSettingsSection>
  );
}

import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { FormCheckbox } from '@/components/form/FormCheckbox';
import { Button } from '@/components/ui/v3/button';
import { Label } from '@/components/ui/v3/label';
import { Switch } from '@/components/ui/v3/switch';
import type {
  RolePermissionEditorFormValues,
  RootFields,
} from '@/features/orgs/projects/database/dataGrid/components/EditPermissionsForm/RolePermissionEditorForm';
import PermissionSettingsSection from './PermissionSettingsSection';

function countSelected(fields: RootFields, includeAggregate: boolean): number {
  return (
    Number(fields.select) +
    Number(fields.select_by_pk) +
    (includeAggregate ? Number(fields.select_aggregate) : 0)
  );
}

export default function RootFieldPermissionsSection() {
  const { control, setValue } =
    useFormContext<RolePermissionEditorFormValues>();
  const allowAggregations = useWatch({
    name: 'allowAggregations',
  }) as boolean;
  const enableRootFieldCustomization = useWatch({
    name: 'enableRootFieldCustomization',
  }) as boolean;
  const queryRootFields = useWatch({
    name: 'queryRootFields',
  }) as RootFields;
  const subscriptionRootFields = useWatch({
    name: 'subscriptionRootFields',
  }) as RootFields;

  const totalAvailable = allowAggregations ? 3 : 2;
  const isQueryAllSelected =
    countSelected(queryRootFields, allowAggregations) === totalAvailable;
  const isSubscriptionAllSelected =
    countSelected(subscriptionRootFields, allowAggregations) === totalAvailable;

  function toggleQueryRootFields() {
    setValue(
      'queryRootFields',
      isQueryAllSelected
        ? { select: false, select_by_pk: false, select_aggregate: false }
        : {
            select: true,
            select_by_pk: true,
            select_aggregate: allowAggregations,
          },
      { shouldDirty: true },
    );
  }

  function toggleSubscriptionRootFields() {
    setValue(
      'subscriptionRootFields',
      isSubscriptionAllSelected
        ? { select: false, select_by_pk: false, select_aggregate: false }
        : {
            select: true,
            select_by_pk: true,
            select_aggregate: allowAggregations,
          },
      { shouldDirty: true },
    );
  }

  return (
    <PermissionSettingsSection title="Root fields permissions">
      <p className="text-muted-foreground">
        By enabling this you can customize the root field permissions. When this
        switch is turned off, all values are enabled by default.
      </p>

      <Controller
        control={control}
        name="enableRootFieldCustomization"
        render={({ field }) => (
          <div className="flex items-center gap-2">
            <Switch
              id="enableRootFieldCustomization"
              checked={field.value}
              onCheckedChange={(checked) => {
                field.onChange(checked);

                if (!checked) {
                  setValue('queryRootFields', {
                    select: false,
                    select_by_pk: false,
                    select_aggregate: false,
                  });
                  setValue('subscriptionRootFields', {
                    select: false,
                    select_by_pk: false,
                    select_aggregate: false,
                  });
                  return;
                }

                setValue('queryRootFields', {
                  select: true,
                  select_by_pk: true,
                  select_aggregate: allowAggregations,
                });
                setValue('subscriptionRootFields', {
                  select: true,
                  select_by_pk: true,
                  select_aggregate: allowAggregations,
                });
              }}
            />
            <Label
              htmlFor="enableRootFieldCustomization"
              className="font-normal text-muted-foreground"
            >
              Enable GraphQL root field visibility customization
            </Label>
          </div>
        )}
      />

      {enableRootFieldCustomization && (
        <div className="grid grid-flow-row gap-4">
          <div className="grid grid-flow-row gap-2">
            <div className="grid grid-flow-row items-center justify-center gap-2 sm:grid-flow-col sm:justify-between">
              <p>
                Allow the following root fields under the{' '}
                <strong>query root field</strong>:
              </p>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-primary"
                onClick={toggleQueryRootFields}
              >
                {isQueryAllSelected ? 'Deselect All' : 'Select All'}
              </Button>
            </div>

            <div className="flex flex-row flex-wrap justify-start gap-6">
              <FormCheckbox
                control={control}
                name="queryRootFields.select"
                label="select"
              />
              <FormCheckbox
                control={control}
                name="queryRootFields.select_by_pk"
                label="select_by_pk"
              />
              <FormCheckbox
                control={control}
                name="queryRootFields.select_aggregate"
                label="select_aggregate"
                disabled={!allowAggregations}
                uncheckWhenDisabled
              />
            </div>
          </div>

          <div className="grid grid-flow-row gap-2">
            <div className="grid grid-flow-row items-center justify-center gap-2 sm:grid-flow-col sm:justify-between">
              <p>
                Allow the following root fields under the{' '}
                <strong>subscription root field</strong>:
              </p>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-primary"
                onClick={toggleSubscriptionRootFields}
              >
                {isSubscriptionAllSelected ? 'Deselect All' : 'Select All'}
              </Button>
            </div>

            <div className="flex flex-row flex-wrap justify-start gap-6">
              <FormCheckbox
                control={control}
                name="subscriptionRootFields.select"
                label="select"
              />
              <FormCheckbox
                control={control}
                name="subscriptionRootFields.select_by_pk"
                label="select_by_pk"
              />
              <FormCheckbox
                control={control}
                name="subscriptionRootFields.select_aggregate"
                label="select_aggregate"
                disabled={!allowAggregations}
                uncheckWhenDisabled
              />
            </div>
          </div>
        </div>
      )}
    </PermissionSettingsSection>
  );
}

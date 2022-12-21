import { useDialog } from '@/components/common/DialogProvider';
import Form from '@/components/common/Form';
import HighlightedText from '@/components/common/HighlightedText';
import type {
  DatabaseAction,
  HasuraMetadataPermission,
  RuleGroup,
} from '@/types/dataBrowser';
import Button from '@/ui/v2/Button';
import Text from '@/ui/v2/Text';
import convertToRuleGroup from '@/utils/dataBrowser/convertToRuleGroup';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import AggregationQuerySection from './AggregationQuerySection';
import ColumnPermissionsSection from './ColumnPermissionsSection';
import type { ColumnPreset } from './ColumnPresetsSection';
import ColumnPresetsSection from './ColumnPresetsSection';
import RootFieldPermissionsSection from './RootFieldPermissionsSection';
import RowPermissionsSection from './RowPermissionsSection';

export interface RolePermissionEditorFormValues {
  /**
   * The permission filter to be applied for the role.
   */
  filter: Record<string, any> | {};
  /**
   * The allowed columns to CRUD for the role.
   */
  columns?: string[];
  /**
   * The number of rows to be returned for the role.
   */
  limit?: number;
  /**
   * Whether the role is allowed to perform aggregations.
   */
  allowAggregations?: boolean;
  /**
   * Whether the role is allowed to have access to special fields.
   */
  enableRootFieldCustomization?: boolean;
  /**
   * The allowed root fields in queries and mutations for the role.
   */
  queryRootFields?: string[];
  /**
   * The allowed root fields in subscriptions for the role.
   */
  subscriptionRootFields?: string[];
  /**
   * Column presets for the role.
   */
  columnPresets?: ColumnPreset[];
}

export interface RolePermissionEditorFormProps {
  /**
   * The schema that is being edited.
   */
  schema: string;
  /**
   * The table that is being edited.
   */
  table: string;
  /**
   * The role that is being edited.
   */
  role: string;
  /**
   * The action that is being edited.
   */
  action: DatabaseAction;
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit: VoidFunction;
  /**
   * Function to be called when the editing is cancelled.
   */
  onCancel: VoidFunction;
  /**
   * The existing permissions for the role and action.
   */
  permission?: HasuraMetadataPermission['permission'];
}

function getDefaultRuleGroup(
  action: DatabaseAction,
  permission: HasuraMetadataPermission['permission'],
): RuleGroup | {} {
  if (!permission) {
    return null;
  }

  if (action === 'insert') {
    return convertToRuleGroup(permission.check);
  }

  return convertToRuleGroup(permission.filter);
}

function getColumnPresets(data: Record<string, any>): ColumnPreset[] {
  if (!data || Object.keys(data).length === 0) {
    return [{ column: '', value: '' }];
  }

  return Object.keys(data).map((key) => ({
    column: key,
    value: data[key],
  }));
}

export default function RolePermissionEditorForm({
  schema,
  table,
  role,
  action,
  onSubmit,
  onCancel,
  permission,
}: RolePermissionEditorFormProps) {
  const form = useForm<RolePermissionEditorFormValues>({
    defaultValues: {
      filter: getDefaultRuleGroup(action, permission),
      columns: permission?.columns || [],
      limit: permission?.limit || null,
      allowAggregations: permission?.allow_aggregations || false,
      enableRootFieldCustomization:
        permission?.query_root_fields?.length > 0 ||
        permission?.subscription_root_fields?.length > 0,
      queryRootFields: permission?.query_root_fields || [],
      subscriptionRootFields: permission?.subscription_root_fields || [],
      columnPresets: getColumnPresets(permission?.set || {}),
    },
  });

  const {
    formState: { dirtyFields, isSubmitting },
  } = form;

  const { onDirtyStateChange } = useDialog();
  const isDirty = Object.keys(dirtyFields).length > 0;

  useEffect(() => {
    onDirtyStateChange(isDirty, 'drawer');
  }, [isDirty, onDirtyStateChange]);

  function handleSubmit(values: RolePermissionEditorFormValues) {
    console.log(values);
    onDirtyStateChange(false, 'drawer');
    onSubmit?.();
  }

  return (
    <FormProvider {...form}>
      <Form
        onSubmit={handleSubmit}
        className="flex flex-auto flex-col content-between overflow-hidden border-t-1 border-gray-200 bg-[#fafafa]"
      >
        <div className="grid grid-flow-row gap-6 content-start flex-auto py-4 overflow-auto">
          <section className="bg-white border-y-1 border-gray-200">
            <Text
              component="h2"
              className="px-6 py-3 font-bold border-b-1 border-gray-200"
            >
              Selected role & action
            </Text>

            <div className="grid grid-flow-col gap-2 items-center justify-between px-6 py-4">
              <div className="grid grid-flow-col gap-4">
                <Text>
                  Role: <HighlightedText>{role}</HighlightedText>
                </Text>

                <Text>
                  Action: <HighlightedText>{action}</HighlightedText>
                </Text>
              </div>

              <Button variant="borderless" onClick={onCancel}>
                Change
              </Button>
            </div>
          </section>

          <RowPermissionsSection
            role={role}
            action={action}
            schema={schema}
            table={table}
          />

          {action !== 'delete' && (
            <ColumnPermissionsSection
              role={role}
              action={action}
              schema={schema}
              table={table}
            />
          )}

          {action === 'select' && (
            <>
              <AggregationQuerySection role={role} />
              <RootFieldPermissionsSection />
            </>
          )}

          {(action === 'insert' || action === 'update') && (
            <ColumnPresetsSection schema={schema} table={table} />
          )}
        </div>

        <div className="grid flex-shrink-0 grid-flow-col justify-between gap-3 border-t-1 border-gray-200 p-2 bg-white">
          <Button
            variant="borderless"
            color="secondary"
            onClick={onCancel}
            tabIndex={isDirty ? -1 : 0}
          >
            Cancel
          </Button>

          <Button
            loading={isSubmitting}
            disabled={isSubmitting}
            type="submit"
            className="justify-self-end"
          >
            Save
          </Button>
        </div>
      </Form>
    </FormProvider>
  );
}

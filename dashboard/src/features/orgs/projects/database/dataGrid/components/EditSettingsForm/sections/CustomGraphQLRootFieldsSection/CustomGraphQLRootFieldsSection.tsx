import { FormInput } from '@/components/form/FormInput';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/v3/accordion';
import { Form } from '@/components/ui/v3/form';
import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import { useSetTableCustomizationMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useSetTableCustomizationMutation';
import { useTableCustomizationQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useTableCustomizationQuery';
import prepareCustomGraphQLRootFieldsDTO from '@/features/orgs/projects/database/dataGrid/utils/prepareCustomGraphQLRootFieldsDTO/prepareCustomGraphQLRootFieldsDTO';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type {
  CustomRootField,
  CustomRootFields,
  TableConfig,
} from '@/utils/hasura-api/generated/schemas';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import CustomGraphQLRootFieldsAccordionContent from './CustomGraphQLRootFieldsAccordionContent';

const fieldSchema = z.object({
  fieldName: z.string().optional(),
  commentEnabled: z.enum(['value', 'none']).default('value'),
  comment: z.string().optional(),
});

const validationSchema = z.object({
  customTableName: z.string().optional(),
  queryAndSubscription: z.object({
    select: fieldSchema,
    selectByPk: fieldSchema,
    selectAggregate: fieldSchema,
    selectStream: fieldSchema,
  }),
  mutation: z.object({
    insert: fieldSchema,
    insertOne: fieldSchema,
    update: fieldSchema,
    updateByPk: fieldSchema,
    updateMany: fieldSchema,
    delete: fieldSchema,
    deleteByPk: fieldSchema,
  }),
});

export type CustomGraphQLRootFieldsFormValues = z.infer<
  typeof validationSchema
>;
type QueryFieldName =
  keyof CustomGraphQLRootFieldsFormValues['queryAndSubscription'];
type MutationFieldName = keyof CustomGraphQLRootFieldsFormValues['mutation'];

type SectionConfig<TSection extends 'queryAndSubscription' | 'mutation'> = {
  key: keyof CustomGraphQLRootFieldsFormValues[TSection];
  label: string;
  buildFieldPlaceholder: (tableName: string) => string;
  buildCommentPlaceholder: (tableName: string) => string;
};

const defaultValues: CustomGraphQLRootFieldsFormValues = {
  customTableName: '',
  queryAndSubscription: {
    select: {
      fieldName: '',
      commentEnabled: 'value',
      comment: '',
    },
    selectByPk: {
      fieldName: '',
      commentEnabled: 'value',
      comment: '',
    },
    selectAggregate: {
      fieldName: '',
      commentEnabled: 'value',
      comment: '',
    },
    selectStream: {
      fieldName: '',
      commentEnabled: 'value',
      comment: '',
    },
  },
  mutation: {
    insert: {
      fieldName: '',
      commentEnabled: 'value',
      comment: '',
    },
    insertOne: {
      fieldName: '',
      commentEnabled: 'value',
      comment: '',
    },
    update: {
      fieldName: '',
      commentEnabled: 'value',
      comment: '',
    },
    updateByPk: {
      fieldName: '',
      commentEnabled: 'value',
      comment: '',
    },
    updateMany: {
      fieldName: '',
      commentEnabled: 'value',
      comment: '',
    },
    delete: {
      fieldName: '',
      commentEnabled: 'value',
      comment: '',
    },
    deleteByPk: {
      fieldName: '',
      commentEnabled: 'value',
      comment: '',
    },
  },
};

const queryFields: SectionConfig<'queryAndSubscription'>[] = [
  {
    key: 'select',
    label: 'Select',
    buildFieldPlaceholder: (table) => `${table} (default)`,
    buildCommentPlaceholder: (table) => `fetch data from the table: "${table}"`,
  },
  {
    key: 'selectByPk',
    label: 'Select by PK',
    buildFieldPlaceholder: (table) => `${table}_by_pk (default)`,
    buildCommentPlaceholder: (table) =>
      `fetch a single row from the table: "${table}"`,
  },
  {
    key: 'selectAggregate',
    label: 'Select aggregate',
    buildFieldPlaceholder: (table) => `${table}_aggregate (default)`,
    buildCommentPlaceholder: (table) =>
      `fetch aggregate fields from the table: "${table}"`,
  },
  {
    key: 'selectStream',
    label: 'Select stream',
    buildFieldPlaceholder: (table) => `${table}_stream (default)`,
    buildCommentPlaceholder: (table) =>
      `stream rows from the table: "${table}"`,
  },
] as const;

const mutationFields: SectionConfig<'mutation'>[] = [
  {
    key: 'insert',
    label: 'Insert',
    buildFieldPlaceholder: (table) => `insert_${table} (default)`,
    buildCommentPlaceholder: (table) =>
      `insert data into the table: "${table}"`,
  },
  {
    key: 'insertOne',
    label: 'Insert one',
    buildFieldPlaceholder: (table) => `insert_${table}_one (default)`,
    buildCommentPlaceholder: (table) =>
      `insert a single row into the table: "${table}"`,
  },
  {
    key: 'update',
    label: 'Update',
    buildFieldPlaceholder: (table) => `update_${table} (default)`,
    buildCommentPlaceholder: (table) => `update data of the table: "${table}"`,
  },
  {
    key: 'updateByPk',
    label: 'Update by PK',
    buildFieldPlaceholder: (table) => `update_${table}_by_pk (default)`,
    buildCommentPlaceholder: (table) =>
      `update a single row of the table: "${table}"`,
  },
  {
    key: 'updateMany',
    label: 'Update many',
    buildFieldPlaceholder: (table) => `update_many_${table} (default)`,
    buildCommentPlaceholder: (table) =>
      `update data for "many" operations of the table: "${table}"`,
  },
  {
    key: 'delete',
    label: 'Delete',
    buildFieldPlaceholder: (table) => `delete_${table} (default)`,
    buildCommentPlaceholder: (table) =>
      `delete data from the table: "${table}"`,
  },
  {
    key: 'deleteByPk',
    label: 'Delete by PK',
    buildFieldPlaceholder: (table) => `delete_${table}_by_pk (default)`,
    buildCommentPlaceholder: (table) =>
      `delete a single row from the table: "${table}"`,
  },
] as const;

type CustomRootFieldsWithUpdateMany = CustomRootFields & {
  update_many?: string | CustomRootField;
};

type FormFieldValue =
  CustomGraphQLRootFieldsFormValues['queryAndSubscription']['select'];

function createDefaultFormFieldValue(): FormFieldValue {
  return {
    fieldName: '',
    commentEnabled: 'value',
    comment: '',
  };
}

function buildFormFieldValue(
  rootField?: string | CustomRootField | null,
): FormFieldValue {
  if (!rootField) {
    return createDefaultFormFieldValue();
  }

  if (typeof rootField === 'string') {
    return {
      fieldName: rootField,
      commentEnabled: 'none',
      comment: '',
    };
  }

  return {
    fieldName: rootField.name ?? '',
    commentEnabled: 'value',
    comment: rootField.comment ?? '',
  };
}

export function buildCustomGraphQLRootFieldsFormValues(
  tableConfig?: TableConfig | null,
): CustomGraphQLRootFieldsFormValues {
  const customRootFields = tableConfig?.custom_root_fields as
    | CustomRootFieldsWithUpdateMany
    | undefined;

  return {
    customTableName: tableConfig?.custom_name ?? '',
    queryAndSubscription: {
      select: buildFormFieldValue(customRootFields?.select),
      selectByPk: buildFormFieldValue(customRootFields?.select_by_pk),
      selectAggregate: buildFormFieldValue(customRootFields?.select_aggregate),
      selectStream: buildFormFieldValue(customRootFields?.select_stream),
    },
    mutation: {
      insert: buildFormFieldValue(customRootFields?.insert),
      insertOne: buildFormFieldValue(customRootFields?.insert_one),
      update: buildFormFieldValue(customRootFields?.update),
      updateByPk: buildFormFieldValue(customRootFields?.update_by_pk),
      updateMany: buildFormFieldValue(customRootFields?.update_many),
      delete: buildFormFieldValue(customRootFields?.delete),
      deleteByPk: buildFormFieldValue(customRootFields?.delete_by_pk),
    },
  };
}

interface CustomGraphQLRootFieldsFormProps {
  schema: string;
  tableName: string;
}

export default function CustomGraphQLRootFieldsSection({
  schema,
  tableName,
}: CustomGraphQLRootFieldsFormProps) {
  const { mutateAsync: setTableCustomization } =
    useSetTableCustomizationMutation();
  const {
    data: columnConfig,
    isLoading: isLoadingTableCustomization,
    refetch: refetchTableCustomization,
  } = useTableCustomizationQuery({
    table: {
      name: tableName,
      schema,
    },
    dataSource: 'default',
  });

  const form = useForm<CustomGraphQLRootFieldsFormValues>({
    defaultValues,
    resolver: zodResolver(validationSchema),
  });

  const { formState } = form;

  const customTableName = form.watch('customTableName');

  const tableNameAlias = customTableName || tableName;

  useEffect(() => {
    if (isLoadingTableCustomization) {
      return;
    }
    form.reset(buildCustomGraphQLRootFieldsFormValues(columnConfig));
  }, [columnConfig, form, isLoadingTableCustomization]);

  const { data: resourceVersion } = useGetMetadataResourceVersion();

  const handleSubmit = form.handleSubmit(async (values) => {
    const dto = prepareCustomGraphQLRootFieldsDTO(values);
    const promise = setTableCustomization({
      resourceVersion,
      args: {
        table: {
          name: tableName,
          schema,
        },
        source: 'default',
        configuration: {
          ...columnConfig,
          custom_root_fields: dto,
        },
      },
    });
    await execPromiseWithErrorToast(() => promise, {
      loadingMessage: 'Setting GraphQL root fields...',
      successMessage: 'GraphQL root fields set successfully.',
      errorMessage: 'An error occurred while setting GraphQL root fields.',
    });
    await refetchTableCustomization();
  });

  type QueryFieldNamePath = `queryAndSubscription.${QueryFieldName}.fieldName`;
  type QueryCommentEnabledPath =
    `queryAndSubscription.${QueryFieldName}.commentEnabled`;
  type QueryCommentPath = `queryAndSubscription.${QueryFieldName}.comment`;

  type MutationFieldNamePath = `mutation.${MutationFieldName}.fieldName`;
  type MutationCommentEnabledPath =
    `mutation.${MutationFieldName}.commentEnabled`;
  type MutationCommentPath = `mutation.${MutationFieldName}.comment`;

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 pb-4">
        <SettingsContainer
          title="Custom GraphQL Root Fields"
          description="Configure the root field names and optional comments exposed in your GraphQL API."
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty,
              loading: formState.isSubmitting,
            },
          }}
        >
          <FormInput
            control={form.control}
            name="customTableName"
            label="Custom Table Name"
            placeholder={`${tableNameAlias} (default)`}
            className=""
          />
          <Accordion type="multiple" defaultValue={['query-and-subscription']}>
            <AccordionItem value="query-and-subscription">
              <AccordionTrigger className="text-sm font-semibold">
                Query and Subscription
              </AccordionTrigger>
              <AccordionContent className="px-0 py-4">
                <div className="grid gap-3">
                  <div className="grid grid-cols-[120px,minmax(0,0.8fr),minmax(0,1fr)] items-center gap-3 rounded-md bg-muted px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <span>Operation</span>
                    <span>Field Name</span>
                    <span>Comment</span>
                  </div>
                  {queryFields.map((fieldConfig) => {
                    const fieldNamePath =
                      `queryAndSubscription.${fieldConfig.key}.fieldName` as QueryFieldNamePath;
                    const commentEnabledPath =
                      `queryAndSubscription.${fieldConfig.key}.commentEnabled` as QueryCommentEnabledPath;
                    const commentPath =
                      `queryAndSubscription.${fieldConfig.key}.comment` as QueryCommentPath;
                    const fieldPlaceholder =
                      fieldConfig.buildFieldPlaceholder(tableNameAlias);
                    const commentPlaceholder =
                      fieldConfig.buildCommentPlaceholder(tableNameAlias);
                    const isCommentDisabled =
                      form.watch(commentEnabledPath) === 'none';

                    return (
                      <CustomGraphQLRootFieldsAccordionContent
                        fieldLabel={fieldConfig.label}
                        key={`query-${String(fieldConfig.key)}`}
                        commentEnabledPath={commentEnabledPath}
                        commentPath={commentPath}
                        fieldNamePath={fieldNamePath}
                        fieldPlaceholder={fieldPlaceholder}
                        commentPlaceholder={commentPlaceholder}
                        isCommentDisabled={isCommentDisabled}
                      />
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="mutation" className="overflow-hidden">
              <AccordionTrigger className="text-sm font-semibold">
                Mutation
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="grid gap-3">
                  <div className="grid grid-cols-[120px,minmax(0,1fr),minmax(0,1fr)] items-center gap-3 rounded-md bg-muted px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <span>Operation</span>
                    <span>Field Name</span>
                    <span>Comment</span>
                  </div>
                  {mutationFields.map((fieldConfig) => {
                    const fieldNamePath =
                      `mutation.${fieldConfig.key}.fieldName` as MutationFieldNamePath;
                    const commentEnabledPath =
                      `mutation.${fieldConfig.key}.commentEnabled` as MutationCommentEnabledPath;
                    const commentPath =
                      `mutation.${fieldConfig.key}.comment` as MutationCommentPath;
                    const fieldPlaceholder =
                      fieldConfig.buildFieldPlaceholder(tableNameAlias);
                    const commentPlaceholder =
                      fieldConfig.buildCommentPlaceholder(tableNameAlias);
                    const isCommentDisabled =
                      form.watch(commentEnabledPath) === 'none';

                    return (
                      <CustomGraphQLRootFieldsAccordionContent
                        fieldLabel={fieldConfig.label}
                        key={`mutation-${String(fieldConfig.key)}`}
                        commentEnabledPath={commentEnabledPath}
                        commentPath={commentPath}
                        fieldNamePath={fieldNamePath}
                        fieldPlaceholder={fieldPlaceholder}
                        commentPlaceholder={commentPlaceholder}
                        isCommentDisabled={isCommentDisabled}
                      />
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </SettingsContainer>
      </form>
    </Form>
  );
}

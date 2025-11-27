import { FormInput } from '@/components/form/FormInput';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/v3/accordion';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Form } from '@/components/ui/v3/form';
import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import { useSetTableCustomizationMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useSetTableCustomizationMutation';
import { useTableCustomizationQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useTableCustomizationQuery';
import { parseCustomGQLRootFieldsFormDefaultValues } from '@/features/orgs/projects/database/dataGrid/parseCustomGQLRootFieldsFormDefaultValues';
import prepareCustomGraphQLRootFieldsDTO from '@/features/orgs/projects/database/dataGrid/utils/prepareCustomGraphQLRootFieldsDTO/prepareCustomGraphQLRootFieldsDTO';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import type { FieldPath, FieldPathValue } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import CustomGraphQLRootFieldsAccordionContent from './CustomGraphQLRootFieldsAccordionContent';
import {
  type CustomGraphQLRootFieldsFormValues,
  defaultValues,
  type MutationFieldName,
  mutationFields,
  type QueryFieldName,
  queryFields,
  validationSchema,
} from './CustomGraphQLRootFieldsFormTypes';

function convertToCamelCase(value?: string | null): string {
  const normalizedValue = value ?? '';

  if (!normalizedValue) {
    return '';
  }

  if (!normalizedValue.includes('_')) {
    return normalizedValue;
  }

  const parts = normalizedValue.split('_').filter(Boolean);

  if (!parts.length) {
    return '';
  }

  return parts
    .map((segment, index) => {
      const lowerCased = segment.toLowerCase();

      if (index === 0) {
        return lowerCased;
      }

      return `${lowerCased.charAt(0).toUpperCase()}${lowerCased.slice(1)}`;
    })
    .join('');
}

function convertPlaceholderToCamelCase(placeholder: string): string {
  const trimmedPlaceholder = placeholder
    .replace(/\s*\(default\)\s*$/i, '')
    .trim();

  return convertToCamelCase(trimmedPlaceholder);
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
    form.reset(parseCustomGQLRootFieldsFormDefaultValues(columnConfig));
  }, [columnConfig, form, isLoadingTableCustomization]);

  const { data: resourceVersion } = useGetMetadataResourceVersion();

  const handleSubmit = form.handleSubmit(async (values) => {
    console.log('values', values);
    const customName = values.customTableName?.trim() ?? null;
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
          custom_name: customName,
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
  type QueryCommentPath = `queryAndSubscription.${QueryFieldName}.comment`;

  type MutationFieldNamePath = `mutation.${MutationFieldName}.fieldName`;
  type MutationCommentPath = `mutation.${MutationFieldName}.comment`;

  const setFieldValue = <
    TFieldPath extends FieldPath<CustomGraphQLRootFieldsFormValues>,
  >(
    path: TFieldPath,
    nextValue: FieldPathValue<CustomGraphQLRootFieldsFormValues, TFieldPath>,
  ) => {
    const currentValue = form.getValues(path);

    if (currentValue === nextValue) {
      return;
    }

    form.setValue(path, nextValue, {
      shouldDirty: true,
      shouldTouch: true,
    });
  };

  const handleMakeCamelCaseClick = () => {
    const customTableNameValue = form.getValues('customTableName');
    const nextCustomTableNameValue = customTableNameValue?.trim()
      ? convertToCamelCase(customTableNameValue)
      : convertPlaceholderToCamelCase(`${tableName} (default)`);

    setFieldValue('customTableName', nextCustomTableNameValue);

    queryFields.forEach((fieldConfig) => {
      const fieldNamePath =
        `queryAndSubscription.${fieldConfig.key}.fieldName` as QueryFieldNamePath;
      const currentValue = form.getValues(fieldNamePath);
      const placeholderValue = convertPlaceholderToCamelCase(
        fieldConfig.buildFieldPlaceholder(tableNameAlias),
      );
      const nextValue = currentValue?.trim()
        ? convertToCamelCase(currentValue)
        : placeholderValue;

      setFieldValue(fieldNamePath, nextValue);
    });

    mutationFields.forEach((fieldConfig) => {
      const fieldNamePath =
        `mutation.${fieldConfig.key}.fieldName` as MutationFieldNamePath;
      const currentValue = form.getValues(fieldNamePath);
      const placeholderValue = convertPlaceholderToCamelCase(
        fieldConfig.buildFieldPlaceholder(tableNameAlias),
      );
      const nextValue = currentValue?.trim()
        ? convertToCamelCase(currentValue)
        : placeholderValue;

      setFieldValue(fieldNamePath, nextValue);
    });
  };

  const handleResetToDefault = () => {
    setFieldValue('customTableName', defaultValues.customTableName ?? '');

    queryFields.forEach((fieldConfig) => {
      const defaults = defaultValues.queryAndSubscription[fieldConfig.key];

      setFieldValue(
        `queryAndSubscription.${fieldConfig.key}.fieldName` as QueryFieldNamePath,
        defaults.fieldName,
      );
      setFieldValue(
        `queryAndSubscription.${fieldConfig.key}.comment` as QueryCommentPath,
        defaults.comment ?? '',
      );
    });

    mutationFields.forEach((fieldConfig) => {
      const defaults = defaultValues.mutation[fieldConfig.key];

      setFieldValue(
        `mutation.${fieldConfig.key}.fieldName` as MutationFieldNamePath,
        defaults.fieldName,
      );
      setFieldValue(
        `mutation.${fieldConfig.key}.comment` as MutationCommentPath,
        defaults.comment ?? '',
      );
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 pb-4">
        <div className="box grid grid-flow-row gap-4 overflow-hidden rounded-lg border-1 py-4">
          <div className="grid grid-flow-col place-content-between gap-3 px-4">
            <div className="grid grid-flow-col gap-4">
              <div className="grid grid-flow-row gap-1">
                <h2 className="text-lg font-semibold">
                  Custom GraphQL Root Fields
                </h2>

                <p className="text-sm text-muted-foreground">
                  Configure the root field names and optional comments exposed
                  in your GraphQL API.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-flow-row gap-4 px-4">
            <FormInput
              control={form.control}
              name="customTableName"
              label="Custom Table Name"
              placeholder={`${tableNameAlias} (default)`}
              className=""
            />
            <Accordion type="multiple">
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
                      const commentPath =
                        `queryAndSubscription.${fieldConfig.key}.comment` as QueryCommentPath;
                      const fieldPlaceholder =
                        fieldConfig.buildFieldPlaceholder(tableNameAlias);
                      const commentPlaceholder =
                        fieldConfig.buildCommentPlaceholder(tableNameAlias);

                      return (
                        <CustomGraphQLRootFieldsAccordionContent
                          fieldLabel={fieldConfig.label}
                          key={`query-${String(fieldConfig.key)}`}
                          commentPath={commentPath}
                          fieldNamePath={fieldNamePath}
                          fieldPlaceholder={fieldPlaceholder}
                          commentPlaceholder={commentPlaceholder}
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
                <AccordionContent className="px-0 py-4">
                  <div className="grid gap-3">
                    <div className="grid grid-cols-[120px,minmax(0,0.8fr),minmax(0,1fr)] items-center gap-3 rounded-md bg-muted px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <span>Operation</span>
                      <span>Field Name</span>
                      <span>Comment</span>
                    </div>
                    {mutationFields.map((fieldConfig) => {
                      const fieldNamePath =
                        `mutation.${fieldConfig.key}.fieldName` as MutationFieldNamePath;
                      const commentPath =
                        `mutation.${fieldConfig.key}.comment` as MutationCommentPath;
                      const fieldPlaceholder =
                        fieldConfig.buildFieldPlaceholder(tableNameAlias);
                      const commentPlaceholder =
                        fieldConfig.buildCommentPlaceholder(tableNameAlias);

                      return (
                        <CustomGraphQLRootFieldsAccordionContent
                          fieldLabel={fieldConfig.label}
                          key={`mutation-${String(fieldConfig.key)}`}
                          commentPath={commentPath}
                          fieldNamePath={fieldNamePath}
                          fieldPlaceholder={fieldPlaceholder}
                          commentPlaceholder={commentPlaceholder}
                        />
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          <div className="grid grid-flow-col items-center justify-between gap-x-2 border-t px-4 pt-3.5">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                color="secondary"
                type="button"
                onClick={handleResetToDefault}
              >
                Reset to default
              </Button>
              <Button
                variant="secondary"
                type="button"
                onClick={handleMakeCamelCaseClick}
              >
                Make camelCase
              </Button>
            </div>
            <ButtonWithLoading
              variant={formState.isDirty ? 'default' : 'outline'}
              // variant={submitButton?.disabled ? 'outlined' : 'contained'}

              // color={submitButton?.disabled ? 'secondary' : 'primary'}
              type="submit"
              disabled={!formState.isDirty}
              loading={formState.isSubmitting}
            >
              Save
            </ButtonWithLoading>
          </div>
        </div>
      </form>
    </Form>
  );
}

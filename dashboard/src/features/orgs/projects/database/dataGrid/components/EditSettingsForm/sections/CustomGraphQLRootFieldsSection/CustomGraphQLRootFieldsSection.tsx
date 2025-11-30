import { FormInput } from '@/components/form/FormInput';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/v3/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Form } from '@/components/ui/v3/form';
import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import { useSetTableCustomizationMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useSetTableCustomizationMutation';
import { useTableCustomizationQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useTableCustomizationQuery';
import { parseCustomGQLRootFieldsFormDefaultValues } from '@/features/orgs/projects/database/dataGrid/parseCustomGQLRootFieldsFormDefaultValues';
import { convertSnakeToCamelCase } from '@/features/orgs/projects/database/dataGrid/utils/convertSnakeToCamelCase';
import prepareCustomGraphQLRootFieldsDTO from '@/features/orgs/projects/database/dataGrid/utils/prepareCustomGraphQLRootFieldsDTO/prepareCustomGraphQLRootFieldsDTO';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { isEmptyValue } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import CustomGraphQLRootFieldsFieldGroup from './CustomGraphQLRootFieldsFieldGroup';
import {
  type CustomGraphQLRootFieldsFormValues,
  type MutationFieldNamePath,
  type QueryFieldNamePath,
  defaultValues,
  getFieldPlaceholder,
  MUTATION_FIELDS_CONFIG,
  QUERY_FIELDS_CONFIG,
  validationSchema,
} from './CustomGraphQLRootFieldsFormTypes';
import CustomGraphQLRootFieldsSectionSkeleton from './CustomGraphQLRootFieldsSectionSkeleton';

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
    data: tableConfig,
    isLoading: isLoadingTableCustomization,
    refetch: refetchTableCustomization,
    error: tableCustomizationError,
    isError: isTableCustomizationError,
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

  const [expandedAccordionItems, setExpandedAccordionItems] = useState<
    ('query-and-subscription' | 'mutation')[]
  >([]);

  const { formState, reset, setValue } = form;

  const customTableName = form.watch('customTableName');

  const tableNameAlias = isEmptyValue(customTableName)
    ? tableName
    : customTableName!;

  useEffect(() => {
    if (isLoadingTableCustomization) {
      return;
    }
    reset(parseCustomGQLRootFieldsFormDefaultValues(tableConfig));
  }, [tableConfig, reset, isLoadingTableCustomization]);

  const { data: resourceVersion } = useGetMetadataResourceVersion();

  const tableCustomizationErrorMessage =
    tableCustomizationError instanceof Error
      ? tableCustomizationError.message
      : 'An error occurred while loading the table customization.';

  if (isLoadingTableCustomization) {
    return <CustomGraphQLRootFieldsSectionSkeleton />;
  }

  const handleSubmit = form.handleSubmit(async (values) => {
    const dto = prepareCustomGraphQLRootFieldsDTO(values, tableConfig!);
    const promise = setTableCustomization({
      resourceVersion,
      args: {
        table: {
          name: tableName,
          schema,
        },
        source: 'default',
        configuration: dto,
      },
    });
    await execPromiseWithErrorToast(() => promise, {
      loadingMessage: 'Setting GraphQL root fields...',
      successMessage: 'GraphQL root fields set successfully.',
      errorMessage: 'An error occurred while setting GraphQL root fields.',
    });
    await refetchTableCustomization();
  });

  const handleAccordionValueChange = (
    nextValues: ('query-and-subscription' | 'mutation')[],
  ) => {
    setExpandedAccordionItems(nextValues);
  };

  const handleMakeCamelCaseClick = () => {
    const nextCustomTableNameValue = convertSnakeToCamelCase(tableNameAlias);

    setValue('customTableName', nextCustomTableNameValue, {
      shouldDirty: true,
    });

    QUERY_FIELDS_CONFIG.forEach((fieldConfig) => {
      const fieldNamePath =
        `queryAndSubscription.${fieldConfig.key}.fieldName` satisfies QueryFieldNamePath;
      const currentValue = form.getValues(fieldNamePath);
      const defaultFieldValue =
        fieldConfig.getDefaultFieldValue(tableNameAlias);
      const camelCaseDefaultFieldValue =
        convertSnakeToCamelCase(defaultFieldValue);

      const nextValue = isEmptyValue(currentValue?.trim())
        ? camelCaseDefaultFieldValue
        : convertSnakeToCamelCase(currentValue);

      setValue(fieldNamePath, nextValue, {
        shouldDirty: true,
      });
    });

    MUTATION_FIELDS_CONFIG.forEach((fieldConfig) => {
      const fieldNamePath =
        `mutation.${fieldConfig.key}.fieldName` satisfies MutationFieldNamePath;
      const currentValue = form.getValues(fieldNamePath);
      const defaultFieldValue =
        fieldConfig.getDefaultFieldValue(tableNameAlias);
      const camelCaseDefaultFieldValue =
        convertSnakeToCamelCase(defaultFieldValue);
      const nextValue = isEmptyValue(currentValue?.trim())
        ? camelCaseDefaultFieldValue
        : convertSnakeToCamelCase(currentValue);

      setValue(fieldNamePath, nextValue, {
        shouldDirty: true,
      });
    });

    setExpandedAccordionItems(['query-and-subscription', 'mutation']);
  };

  const handleResetToDefaultClick = () => {
    setValue('customTableName', '', {
      shouldDirty: true,
    });

    QUERY_FIELDS_CONFIG.forEach((fieldConfig) => {
      setValue(`queryAndSubscription.${fieldConfig.key}.fieldName`, '', {
        shouldDirty: true,
      });
      setValue(`queryAndSubscription.${fieldConfig.key}.comment`, '', {
        shouldDirty: true,
      });
    });
    MUTATION_FIELDS_CONFIG.forEach((fieldConfig) => {
      setValue(`mutation.${fieldConfig.key}.fieldName`, '', {
        shouldDirty: true,
      });
      setValue(`mutation.${fieldConfig.key}.comment`, '', {
        shouldDirty: true,
      });
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

                <p className="text-sm+ text-muted-foreground">
                  Configure the root field names and optional comments exposed
                  in your GraphQL API.
                </p>
              </div>
            </div>
          </div>
          {isTableCustomizationError ? (
            <Alert variant="destructive">
              <AlertTitle>Unable to load table customization</AlertTitle>
              <AlertDescription>
                {tableCustomizationErrorMessage && (
                  <span>{tableCustomizationErrorMessage}</span>
                )}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid grid-flow-row gap-4 px-4">
              <FormInput
                control={form.control}
                name="customTableName"
                label="Custom Table Name"
                placeholder={`${tableNameAlias} (default)`}
                className="max-w-sm"
              />
              <Accordion
                type="multiple"
                value={expandedAccordionItems}
                onValueChange={handleAccordionValueChange}
              >
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
                      {QUERY_FIELDS_CONFIG.map((fieldConfig) => {
                        const fieldNamePath = `queryAndSubscription.${fieldConfig.key}.fieldName`;
                        const commentPath = `queryAndSubscription.${fieldConfig.key}.comment`;
                        const fieldPlaceholder = getFieldPlaceholder(
                          fieldConfig,
                          tableNameAlias,
                        );
                        const commentPlaceholder =
                          fieldConfig.getCommentPlaceholder(tableNameAlias);

                        return (
                          <CustomGraphQLRootFieldsFieldGroup
                            fieldLabel={fieldConfig.label}
                            key={`query-${fieldConfig.key}`}
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
                      {MUTATION_FIELDS_CONFIG.map((fieldConfig) => {
                        const fieldNamePath = `mutation.${fieldConfig.key}.fieldName`;
                        const commentPath = `mutation.${fieldConfig.key}.comment`;
                        const fieldPlaceholder = getFieldPlaceholder(
                          fieldConfig,
                          tableNameAlias,
                        );
                        const commentPlaceholder =
                          fieldConfig.getCommentPlaceholder(tableNameAlias);

                        return (
                          <CustomGraphQLRootFieldsFieldGroup
                            fieldLabel={fieldConfig.label}
                            key={`mutation-${fieldConfig.key}`}
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
          )}

          <div className="grid grid-flow-col items-center justify-between gap-x-2 border-t px-4 pt-3.5">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                color="secondary"
                type="button"
                onClick={handleResetToDefaultClick}
                disabled={isTableCustomizationError}
              >
                Reset to default
              </Button>
              <Button
                variant="secondary"
                type="button"
                onClick={handleMakeCamelCaseClick}
                disabled={isTableCustomizationError}
              >
                Make camelCase
              </Button>
            </div>
            <ButtonWithLoading
              variant={formState.isDirty ? 'default' : 'outline'}
              type="submit"
              disabled={!formState.isDirty || isTableCustomizationError}
              loading={formState.isSubmitting}
              className="text-sm+"
            >
              Save
            </ButtonWithLoading>
          </div>
        </div>
      </form>
    </Form>
  );
}

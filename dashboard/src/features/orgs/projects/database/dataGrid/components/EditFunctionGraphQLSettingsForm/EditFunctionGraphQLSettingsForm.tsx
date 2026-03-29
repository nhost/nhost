import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormInput } from '@/components/form/FormInput';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Form } from '@/components/ui/v3/form';
import { Spinner } from '@/components/ui/v3/spinner';
import { TrackUntrackSection } from '@/features/orgs/projects/database/dataGrid/components/EditGraphQLSettingsForm/sections/TrackUntrackSection';
import { useFunctionCustomizationQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useFunctionCustomizationQuery';
import { useFunctionQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useFunctionQuery';
import { useSetFunctionCustomizationMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useSetFunctionCustomizationMutation';
import { useTrackFunctionWithTable } from '@/features/orgs/projects/database/dataGrid/hooks/useTrackFunctionWithTable';
import { convertSnakeToCamelCase } from '@/features/orgs/projects/database/dataGrid/utils/convertSnakeToCamelCase';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { cn, isEmptyValue } from '@/lib/utils';

const validationSchema = z.object({
  customName: z.string().optional(),
  customRootFieldFunction: z.string().optional(),
  customRootFieldFunctionAggregate: z.string().optional(),
  sessionArgument: z.string().optional(),
});

type FunctionSettingsFormValues = z.infer<typeof validationSchema>;

const defaultValues: FunctionSettingsFormValues = {
  customName: '',
  customRootFieldFunction: '',
  customRootFieldFunctionAggregate: '',
  sessionArgument: '',
};

export interface EditFunctionGraphQLSettingsFormProps {
  /**
   * Function to be called when the form is closed.
   */
  onCancel?: () => void;
  /**
   * Schema where the function is located.
   */
  schema: string;
  /**
   * Function's name that is being edited/viewed.
   */
  functionName: string;
  /**
   * Function OID used to fetch the function definition.
   */
  functionOID?: string;
  /**
   * Whether the form is disabled, if true, the form will be read-only.
   */
  disabled?: boolean;
}

export default function EditFunctionGraphQLSettingsForm({
  onCancel,
  schema,
  functionName,
  functionOID,
  disabled,
}: EditFunctionGraphQLSettingsFormProps) {
  const { query } = useRouter();
  const { dataSourceSlug } = query;

  const dataSource = dataSourceSlug as string;
  const functionCacheKey =
    dataSource && functionOID ? `${dataSource}.${functionOID}` : '';

  const { data: functionDefinition } = useFunctionQuery(
    ['function-definition', functionCacheKey],
    {
      functionOID,
      dataSource,
      queryOptions: {
        enabled: !!functionCacheKey && !!functionOID,
      },
    },
  );

  const returnTableName = functionDefinition?.functionMetadata?.returnTableName;
  const returnTableSchema =
    functionDefinition?.functionMetadata?.returnTableSchema;

  const {
    isTracked,
    isReturnTableUntracked,
    isPending: isTrackingPending,
    toggleTracking,
  } = useTrackFunctionWithTable({
    dataSource,
    schema,
    functionName,
    returnTableName,
    returnTableSchema,
  });

  async function handleTrackToggle() {
    const tracked = !isTracked;
    const action = tracked ? 'track' : 'untrack';
    const shouldTrackTable = tracked && isReturnTableUntracked;

    await execPromiseWithErrorToast(() => toggleTracking(), {
      loadingMessage: shouldTrackTable
        ? 'Tracking table and function...'
        : `${tracked ? 'Tracking' : 'Untracking'} function...`,
      successMessage: shouldTrackTable
        ? 'Table and function tracked successfully.'
        : `Function ${action}ed successfully.`,
      errorMessage: shouldTrackTable
        ? 'Failed to track table and function.'
        : `Failed to ${action} function.`,
    });
  }

  const isUntracked = !isTracked;

  const { mutateAsync: setFunctionCustomization } =
    useSetFunctionCustomizationMutation();

  const {
    data: functionConfig,
    isLoading: isLoadingFunctionCustomization,
    refetch: refetchFunctionCustomization,
    error: functionCustomizationError,
    isError: isFunctionCustomizationError,
  } = useFunctionCustomizationQuery({
    function: {
      name: functionName,
      schema,
    },
    dataSource,
  });

  const form = useForm<FunctionSettingsFormValues>({
    defaultValues,
    resolver: zodResolver(validationSchema),
  });

  const { formState, reset, getValues, setValue } = form;
  const { isSubmitting, isDirty } = formState;

  useEffect(() => {
    if (isLoadingFunctionCustomization || !functionConfig) {
      return;
    }
    const config = functionConfig.configuration;
    reset({
      customName: config?.custom_name || '',
      customRootFieldFunction: config?.custom_root_fields?.function || '',
      customRootFieldFunctionAggregate:
        config?.custom_root_fields?.function_aggregate || '',
      sessionArgument: config?.session_argument || '',
    });
  }, [functionConfig, reset, isLoadingFunctionCustomization]);

  const functionCustomizationErrorMessage =
    functionCustomizationError instanceof Error
      ? functionCustomizationError.message
      : 'An error occurred while loading the function customization.';

  const handleCancel = () => {
    onCancel?.();
  };

  if (isLoadingFunctionCustomization) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Spinner
          wrapperClassName="flex-row text-[12px] leading-[1.66] font-normal gap-1"
          className="h-4 w-4 justify-center"
        >
          Loading function settings...
        </Spinner>
      </div>
    );
  }

  const handleSubmit = form.handleSubmit(async (values) => {
    const promise = setFunctionCustomization({
      args: {
        function: {
          name: functionName,
          schema,
        },
        source: dataSource,
        configuration: {
          custom_name: values.customName || undefined,
          custom_root_fields: {
            function: values.customRootFieldFunction || undefined,
            function_aggregate:
              values.customRootFieldFunctionAggregate || undefined,
          },
          session_argument: values.sessionArgument || undefined,
        },
      },
    });
    await execPromiseWithErrorToast(() => promise, {
      loadingMessage: 'Updating function settings...',
      successMessage: 'Function settings updated successfully.',
      errorMessage: 'An error occurred while updating function settings.',
    });
    await refetchFunctionCustomization();
  });

  const handleResetToDefaultClick = () => {
    setValue('customName', '', { shouldDirty: true });
    setValue('customRootFieldFunction', '', { shouldDirty: true });
    setValue('customRootFieldFunctionAggregate', '', {
      shouldDirty: true,
    });
    setValue('sessionArgument', '', { shouldDirty: true });
  };

  const handleMakeCamelCaseClick = () => {
    const currentCustomName = getValues('customName');
    const currentCustomRootFieldFunction = getValues('customRootFieldFunction');
    const currentCustomRootFieldFunctionAggregate = getValues(
      'customRootFieldFunctionAggregate',
    );

    const nextCustomName = isEmptyValue(currentCustomName?.trim())
      ? convertSnakeToCamelCase(functionName)
      : convertSnakeToCamelCase(currentCustomName);
    setValue('customName', nextCustomName, { shouldDirty: true });

    const nextCustomRootFieldFunction = isEmptyValue(
      currentCustomRootFieldFunction?.trim(),
    )
      ? convertSnakeToCamelCase(functionName)
      : convertSnakeToCamelCase(currentCustomRootFieldFunction);
    setValue('customRootFieldFunction', nextCustomRootFieldFunction, {
      shouldDirty: true,
    });

    const defaultAggregateValue = `${functionName}_aggregate`;
    const nextCustomRootFieldFunctionAggregate = isEmptyValue(
      currentCustomRootFieldFunctionAggregate?.trim(),
    )
      ? convertSnakeToCamelCase(defaultAggregateValue)
      : convertSnakeToCamelCase(currentCustomRootFieldFunctionAggregate);
    setValue(
      'customRootFieldFunctionAggregate',
      nextCustomRootFieldFunctionAggregate,
      { shouldDirty: true },
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-4">
        <TrackUntrackSection
          isTracked={isTracked}
          isPending={isTrackingPending}
          onTrackToggle={handleTrackToggle}
          disabled={disabled}
          trackLabel={
            isReturnTableUntracked ? 'Track table and function' : undefined
          }
          description={
            isReturnTableUntracked && !isTracked ? (
              <p className="text-muted-foreground text-xs">
                The return table{' '}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                  {returnTableSchema}.{returnTableName}
                </code>{' '}
                is not tracked in GraphQL and will be tracked along with this
                function.
              </p>
            ) : undefined
          }
        />

        <Form {...form}>
          <form
            onSubmit={handleSubmit}
            className="flex min-h-0 flex-1 flex-col gap-4 px-6"
          >
            <div className="box grid grid-flow-row gap-4 overflow-hidden rounded-lg border-1 py-4">
              {isFunctionCustomizationError ? (
                <div className="px-4">
                  <Alert variant="destructive">
                    <AlertTitle>
                      Unable to load function customization
                    </AlertTitle>
                    <AlertDescription>
                      {functionCustomizationErrorMessage && (
                        <p>{functionCustomizationErrorMessage}</p>
                      )}
                    </AlertDescription>
                  </Alert>
                </div>
              ) : (
                <div className="grid grid-flow-row gap-4 px-4">
                  <div className="grid grid-flow-row gap-3">
                    <div className="grid grid-flow-row gap-1">
                      <h3 className="font-semibold text-lg">
                        Custom Function Name
                      </h3>
                      <p className="text-muted-foreground text-sm+">
                        Customize the function name in the GraphQL schema.
                      </p>
                    </div>
                    <FormInput
                      disabled={disabled || isUntracked || isTrackingPending}
                      control={form.control}
                      name="customName"
                      label=""
                      placeholder={`${functionName} (default)`}
                      className="max-w-sm"
                    />
                  </div>

                  <div className="grid grid-flow-row gap-3">
                    <div className="grid grid-flow-row gap-1">
                      <h3 className="font-semibold text-lg">
                        Custom Root Fields
                      </h3>
                      <p className="text-muted-foreground text-sm+">
                        Customize the function root field names.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormInput
                        disabled={disabled || isUntracked || isTrackingPending}
                        control={form.control}
                        name="customRootFieldFunction"
                        label="Function"
                        placeholder={`${functionName} (default)`}
                      />
                      <FormInput
                        disabled={disabled || isUntracked || isTrackingPending}
                        control={form.control}
                        name="customRootFieldFunctionAggregate"
                        label="Function Aggregate"
                        placeholder={`${functionName}_aggregate (default)`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-flow-row gap-3">
                    <div className="grid grid-flow-row gap-1">
                      <h3 className="font-semibold text-lg">
                        Session Argument
                      </h3>
                      <p className="text-muted-foreground text-sm+">
                        Name of the function argument that accepts session info
                        JSON (e.g., hasura_session).
                      </p>
                    </div>
                    <FormInput
                      disabled={disabled || isUntracked || isTrackingPending}
                      control={form.control}
                      name="sessionArgument"
                      label=""
                      placeholder="Enter session argument name..."
                      className="max-w-sm"
                    />
                  </div>
                </div>
              )}

              {!disabled && !isUntracked && (
                <div className="grid grid-flow-col items-center justify-between gap-x-2 border-t px-4 pt-3.5">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      color="secondary"
                      type="button"
                      onClick={handleResetToDefaultClick}
                      disabled={isFunctionCustomizationError || isSubmitting}
                    >
                      Reset to default
                    </Button>
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={handleMakeCamelCaseClick}
                      disabled={isFunctionCustomizationError || isSubmitting}
                    >
                      Make camelCase
                    </Button>
                  </div>
                  <ButtonWithLoading
                    variant={isDirty ? 'default' : 'outline'}
                    type="submit"
                    disabled={!isDirty || isFunctionCustomizationError}
                    loading={isSubmitting}
                    className={cn('text-sm+', { 'text-white': isDirty })}
                  >
                    Save
                  </ButtonWithLoading>
                </div>
              )}
            </div>
          </form>
        </Form>
      </div>

      <div className="grid flex-shrink-0 grid-flow-col justify-between gap-3 border-t-1 px-6 py-3">
        <Button variant="outline" color="secondary" onClick={handleCancel}>
          Back
        </Button>
      </div>
    </div>
  );
}

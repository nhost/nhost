import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormInput } from '@/components/form/FormInput';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Form } from '@/components/ui/v3/form';
import { Spinner } from '@/components/ui/v3/spinner';
import { useFunctionCustomizationQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useFunctionCustomizationQuery';
import { useSetFunctionCustomizationMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useSetFunctionCustomizationMutation';
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

export interface EditFunctionSettingsFormProps {
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
   * Whether the form is disabled, if true, the form will be read-only.
   */
  disabled?: boolean;
}

export default function EditFunctionSettingsForm({
  onCancel,
  schema,
  functionName,
  disabled,
}: EditFunctionSettingsFormProps) {
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
    dataSource: 'default',
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
        source: 'default',
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

    // Convert customName
    const nextCustomName = isEmptyValue(currentCustomName?.trim())
      ? convertSnakeToCamelCase(functionName)
      : convertSnakeToCamelCase(currentCustomName);
    setValue('customName', nextCustomName, { shouldDirty: true });

    // Convert customRootFieldFunction
    const nextCustomRootFieldFunction = isEmptyValue(
      currentCustomRootFieldFunction?.trim(),
    )
      ? convertSnakeToCamelCase(functionName)
      : convertSnakeToCamelCase(currentCustomRootFieldFunction);
    setValue('customRootFieldFunction', nextCustomRootFieldFunction, {
      shouldDirty: true,
    });

    // Convert customRootFieldFunctionAggregate
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
      <Form {...form}>
        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pb-4"
        >
          <div className="box grid grid-flow-row gap-4 overflow-hidden rounded-lg border-1 py-4">
            <div className="grid grid-flow-col place-content-between gap-3 px-4">
              <div className="grid grid-flow-row gap-1">
                <h2 className="font-semibold text-lg">Function Settings</h2>
                <p className="text-muted-foreground text-sm+">
                  Configure the GraphQL settings for this function.
                </p>
              </div>
            </div>

            {isFunctionCustomizationError ? (
              <div className="px-4">
                <Alert variant="destructive">
                  <AlertTitle>Unable to load function customization</AlertTitle>
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
                    disabled={disabled}
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
                      disabled={disabled}
                      control={form.control}
                      name="customRootFieldFunction"
                      label="Function"
                      placeholder={`${functionName} (default)`}
                    />
                    <FormInput
                      disabled={disabled}
                      control={form.control}
                      name="customRootFieldFunctionAggregate"
                      label="Function Aggregate"
                      placeholder={`${functionName}_aggregate (default)`}
                    />
                  </div>
                </div>

                <div className="grid grid-flow-row gap-3">
                  <div className="grid grid-flow-row gap-1">
                    <h3 className="font-semibold text-lg">Session Argument</h3>
                    <p className="text-muted-foreground text-sm+">
                      Name of the function argument that accepts session info
                      JSON (e.g., hasura_session).
                    </p>
                  </div>
                  <FormInput
                    disabled={disabled}
                    control={form.control}
                    name="sessionArgument"
                    label=""
                    placeholder="Enter session argument name..."
                    className="max-w-sm"
                  />
                </div>

                {/* <div className="grid grid-flow-row gap-3">
                  <div className="grid grid-flow-row gap-1">
                    <h3 className="font-semibold text-lg">Expose As</h3>
                    <p className="text-muted-foreground text-sm+">
                      In which part of the schema to expose this function.
                    </p>
                  </div>
                  <FormSelect
                    disabled={disabled}
                    control={form.control}
                    name="exposedAs"
                    label=""
                    placeholder="Select..."
                    className="max-w-sm"
                  >
                    <SelectItem value="query">Query</SelectItem>
                    <SelectItem value="mutation">Mutation</SelectItem>
                  </FormSelect>
                </div> */}
              </div>
            )}

            {!disabled && (
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

      <div className="grid flex-shrink-0 grid-flow-col justify-between gap-3 border-t-1 px-6 py-3">
        <Button variant="outline" color="secondary" onClick={handleCancel}>
          Back
        </Button>
      </div>
    </div>
  );
}

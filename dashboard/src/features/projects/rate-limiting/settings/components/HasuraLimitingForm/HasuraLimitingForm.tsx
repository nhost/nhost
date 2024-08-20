import { useUI } from '@/components/common/UIProvider';
import { ControlledSelect } from '@/components/form/ControlledSelect';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { Box } from '@/components/ui/v2/Box';
import { Input } from '@/components/ui/v2/Input';
import { Option } from '@/components/ui/v2/Option';
import { Text } from '@/components/ui/v2/Text';
import type { DialogFormProps } from '@/types/common';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';
import * as Yup from 'yup';
import {
  intervalUnitOptions,
  rateLimitingItemValidationSchema,
} from '../validationSchemas';

export const validationSchema = Yup.object({
  enabled: Yup.boolean().label('Enabled'),
  bruteForce: rateLimitingItemValidationSchema,
});

export type AuthLimitingFormValues = Yup.InferType<typeof validationSchema>;

export interface AssistantFormProps extends DialogFormProps {
  /**
   * Function to be called when the submit is successful.
   */
  onSubmit?: VoidFunction | ((args?: any) => Promise<any>);
}

export default function HasuraLimitingForm({ onSubmit }: AssistantFormProps) {
  const { maintenanceActive } = useUI();

  const form = useForm<AuthLimitingFormValues>({
    defaultValues: {
      enabled: false,
      bruteForce: {
        limit: undefined,
        interval: undefined,
        intervalUnit: 'm',
      },
    },
    reValidateMode: 'onSubmit',
    resolver: yupResolver(validationSchema),
  });

  const {
    register,
    getValues,
    formState: { errors, dirtyFields },
    formState,
    watch,
  } = form;

  const enabled = watch('enabled');

  const isDirty = Object.keys(dirtyFields).length > 0;

  console.log('values:', getValues());

  const handleSubmit = async (formValues: AuthLimitingFormValues) => {
    await execPromiseWithErrorToast(
      async () => {
        onSubmit?.();
      },
      {
        loadingMessage: 'Configuring the Assistant...',
        successMessage: 'The Assistant has been configured successfully.',
        errorMessage:
          'An error occurred while configuring the Assistant. Please try again.',
      },
    );
  };

  return (
    <FormProvider {...form}>
      <Form
        onSubmit={handleSubmit}
        className="flex h-full flex-col overflow-hidden border-t"
      >
        <SettingsContainer
          title="Hasura"
          switchId="enabled"
          showSwitch
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty || maintenanceActive,
              loading: formState.isSubmitting,
            },
          }}
          className={twMerge(!enabled && 'hidden')}
        >
          <div className="flex flex-1 flex-col space-y-4 overflow-auto p-4">
            <Box className="grid grid-flow-row gap-x-4 gap-y-2 lg:grid-cols-5">
              <div className="flex flex-row items-center gap-2  lg:col-span-2">
                <Text>Limit</Text>
                <Input
                  {...register('bruteForce.limit')}
                  id="bruteForce.limit"
                  type="number"
                  placeholder=""
                  // inputProps={{
                  //   className: 'text-right',
                  // }}
                  hideEmptyHelperText
                  error={!!errors.bruteForce?.limit}
                  helperText={errors?.bruteForce?.limit?.message}
                  fullWidth
                  autoComplete="off"
                />
              </div>
              <div className="grid grid-flow-col items-center gap-x-2 lg:col-span-3">
                <Text>Interval</Text>
                <Input
                  {...register('bruteForce.interval')}
                  id="bruteForce.limit"
                  type="number"
                  placeholder=""
                  hideEmptyHelperText
                  error={!!errors.bruteForce?.interval}
                  helperText={errors?.bruteForce?.interval?.message}
                  fullWidth
                  autoComplete="off"
                />
                <ControlledSelect
                  {...register('bruteForce.intervalUnit')}
                  variant="normal"
                  id="bruteForce.intervalUnit"
                  defaultValue="m"
                  hideEmptyHelperText
                >
                  {intervalUnitOptions.map(({ value, label }) => (
                    <Option
                      key={`bruteForce.intervalUnit.${value}`}
                      value={value}
                    >
                      {label}
                    </Option>
                  ))}
                </ControlledSelect>
              </div>
            </Box>
          </div>
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}

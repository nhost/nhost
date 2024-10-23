import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { IconButton } from '@/components/ui/v2/IconButton';
import { EyeIcon } from '@/components/ui/v2/icons/EyeIcon';
import { EyeOffIcon } from '@/components/ui/v2/icons/EyeOffIcon';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import { Input } from '@/components/ui/v2/Input';
import { InputAdornment } from '@/components/ui/v2/InputAdornment';
import { Option } from '@/components/ui/v2/Option';
import { Select } from '@/components/ui/v2/Select';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import type { ContactPointsFormValues } from '@/features/orgs/projects/metrics/settings/components/ContactPointsSettings/ContactPointsSettingsTypes';
import { useState } from 'react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { HttpMethod } from './WebhookFormSectionTypes';

export default function WebhookFormSection() {
  const {
    register,
    formState: { errors },
    setValue,
    control,
  } = useFormContext<ContactPointsFormValues>();
  const formValues = useWatch<ContactPointsFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'webhook',
  });

  const [showPassword, setShowPassword] = useState(false);

  const onChangeHttpMethod = (value: string | undefined, index: number) =>
    setValue(`webhook.${index}.httpMethod`, value as HttpMethod);

  return (
    <Box className="flex flex-col gap-4 p-4">
      <Box className="flex flex-row items-center justify-between">
        <Box className="flex flex-row items-center space-x-2">
          <Text variant="h4" className="font-semibold">
            Webhook
          </Text>
          <Tooltip
            title={
              <span>
                Send information about a state change to an external service
                over HTTP.
              </span>
            }
          >
            <InfoIcon aria-label="Info" className="h-4 w-4" color="primary" />
          </Tooltip>
        </Box>
        <Button
          variant="borderless"
          onClick={() =>
            append({
              url: '',
              httpMethod: HttpMethod.POST,
              username: '',
              password: '',
              authorizationScheme: '',
              authorizationCredentials: '',
              maxAlerts: 0,
            })
          }
        >
          <PlusIcon className="h-5 w-5" />
        </Button>
      </Box>

      {fields?.length > 0 ? (
        <Box className="flex flex-col gap-12">
          {fields.map((field, index) => (
            <Box key={field.id} className="flex w-full items-center space-x-2">
              <Box className="grid flex-grow gap-4 lg:grid-cols-9">
                <Input
                  {...register(`webhook.${index}.url`)}
                  id={`${field.id}-url`}
                  placeholder="Enter URL"
                  className="w-full lg:col-span-7"
                  hideEmptyHelperText
                  error={!!errors?.webhook?.[index]?.url}
                  helperText={errors?.webhook?.[index]?.url?.message}
                  fullWidth
                  label="URL"
                  autoComplete="off"
                />

                <Select
                  fullWidth
                  value={formValues.webhook.at(index)?.httpMethod || ''}
                  className="lg:col-span-2"
                  label="HTTP Method"
                  onChange={(_event, inputValue) =>
                    onChangeHttpMethod(inputValue as string, index)
                  }
                  placeholder="Select HTTP Method"
                  slotProps={{
                    listbox: { className: 'min-w-0 w-full' },
                    popper: {
                      disablePortal: false,
                      className: 'z-[10000] w-[270px]',
                    },
                  }}
                >
                  {Object.values(HttpMethod).map((httpMethod) => (
                    <Option key={httpMethod} value={httpMethod}>
                      {httpMethod}
                    </Option>
                  ))}
                </Select>

                <Input
                  {...register(`webhook.${index}.username`)}
                  id={`${field.id}-username`}
                  placeholder="Enter username"
                  label="Username"
                  className="w-full lg:col-span-3"
                  hideEmptyHelperText
                  error={!!errors?.webhook?.[index]?.username}
                  helperText={errors?.webhook?.[index]?.username?.message}
                  fullWidth
                  autoComplete="off"
                />

                <Input
                  {...register(`webhook.${index}.password`)}
                  id={`${field.id}-password`}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter password"
                  label="Password"
                  className="w-full lg:col-span-4"
                  hideEmptyHelperText
                  error={!!errors?.webhook?.[index]?.password}
                  helperText={errors?.webhook?.[index]?.password?.message}
                  fullWidth
                  autoComplete="off"
                  endAdornment={
                    <InputAdornment className="px-2" position="end">
                      <IconButton
                        variant="borderless"
                        color="secondary"
                        aria-label={
                          showPassword ? 'Hide Password' : 'Show Password'
                        }
                        onClick={() => setShowPassword((show) => !show)}
                      >
                        {showPassword ? (
                          <EyeOffIcon className="h-5 w-5" />
                        ) : (
                          <EyeIcon className="h-5 w-5" />
                        )}
                      </IconButton>
                    </InputAdornment>
                  }
                />
                <Input
                  type="number"
                  {...register(`webhook.${index}.maxAlerts`)}
                  id={`${field.id}-maxAlerts`}
                  placeholder="Enter max alerts"
                  label="Max Alerts (0 means no limit)"
                  className="w-full lg:col-span-2"
                  hideEmptyHelperText
                  error={!!errors?.webhook?.[index]?.maxAlerts}
                  helperText={errors?.webhook?.[index]?.maxAlerts?.message}
                  fullWidth
                  autoComplete="off"
                />

                <Input
                  {...register(`webhook.${index}.authorizationScheme`)}
                  id={`${field.id}-authorizationScheme`}
                  placeholder="Enter authorization scheme"
                  label="Authorization Scheme"
                  className="w-full lg:col-span-3"
                  hideEmptyHelperText
                  error={!!errors?.webhook?.[index]?.authorizationScheme}
                  helperText={
                    errors?.webhook?.[index]?.authorizationScheme?.message
                  }
                  fullWidth
                  autoComplete="off"
                />
                <Input
                  {...register(`webhook.${index}.authorizationCredentials`)}
                  id={`${field.id}-authorizationCredentials`}
                  placeholder="Enter authorization credentials"
                  label="Authorization Credentials"
                  className="w-full lg:col-span-6"
                  hideEmptyHelperText
                  error={!!errors?.webhook?.[index]?.authorizationCredentials}
                  helperText={
                    errors?.webhook?.[index]?.authorizationCredentials?.message
                  }
                  fullWidth
                  autoComplete="off"
                />
              </Box>

              <Button
                variant="borderless"
                className=""
                color="error"
                onClick={() => remove(index)}
              >
                <TrashIcon className="h-6 w-4" />
              </Button>
            </Box>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}

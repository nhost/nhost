import { ControlledSelect } from '@/components/form/ControlledSelect';
import { ControlledSwitch } from '@/components/form/ControlledSwitch';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import { Input } from '@/components/ui/v2/Input';
import { Option } from '@/components/ui/v2/Option';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { type AssistantFormValues } from '@/features/orgs/projects/ai/AssistantForm/AssistantForm';
import { useFieldArray, useFormContext } from 'react-hook-form';

interface ArgumentsFormSectionProps {
  nestedField: string;
  nestIndex: number;
}

export default function ArgumentsFormSection({
  nestedField,
  nestIndex,
}: ArgumentsFormSectionProps) {
  const form = useFormContext<AssistantFormValues>();

  const {
    register,
    formState: { errors },
  } = form;

  const { fields, append, remove } = useFieldArray({
    name: `${nestedField}.${nestIndex}.arguments`,
  });

  return (
    <Box className="space-y-4">
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-row items-center space-x-2">
          <Text variant="h4" className="font-semibold">
            Arguments
          </Text>
          <Tooltip title={<span>Arguments</span>}>
            <InfoIcon aria-label="Info" className="h-4 w-4" color="primary" />
          </Tooltip>
        </div>
        <Button variant="borderless" onClick={() => append({})}>
          <PlusIcon className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex flex-col space-y-4">
        {fields.map((field, index) => (
          <Box
            key={field.id}
            className="flex flex-col space-y-20 rounded border-1 p-4"
            sx={{ backgroundColor: 'grey.200' }}
          >
            <div className="flex w-full flex-col space-y-4">
              <Input
                // We're putting ts-ignore here so we could use the same components for both graphql and webhooks
                // by passing the nestedField = 'graphql' or nestedField = 'webhooks'
                {...register(
                  // @ts-ignore
                  `${nestedField}.${nestIndex}.arguments.${index}.name`,
                )}
                id={`${field.id}-name`}
                placeholder="Name"
                className="w-full"
                hideEmptyHelperText
                error={
                  !!errors?.[nestedField]?.[nestIndex]?.arguments[index].name
                }
                helperText={
                  errors?.[nestedField]?.[nestIndex]?.arguments[index]?.name
                    ?.message
                }
                fullWidth
                autoComplete="off"
              />

              <Input
                {...register(
                  // @ts-ignore
                  `${nestedField}.${nestIndex}.arguments.${index}.description`,
                )}
                id={`${field.id}-description`}
                placeholder="Description"
                className="w-full"
                hideEmptyHelperText
                error={
                  !!errors?.[nestedField]?.[nestIndex]?.arguments[index]
                    .description
                }
                helperText={
                  errors?.[nestedField]?.[nestIndex]?.arguments[index]
                    ?.description?.message
                }
                fullWidth
                autoComplete="off"
                multiline
                inputProps={{
                  className: 'resize-y min-h-[22px]',
                }}
              />

              <div className="flex flex-row space-x-2">
                <Box className="w-full">
                  <ControlledSelect
                    fullWidth
                    {...register(
                      // @ts-ignore
                      `${nestedField}.${nestIndex}.arguments.${index}.type`,
                    )}
                    id={`${field.id}-type`}
                    placeholder="Select argument type"
                    slotProps={{
                      listbox: { className: 'min-w-0 w-full' },
                      popper: {
                        disablePortal: false,
                        className: 'z-[10000] w-[270px]',
                      },
                    }}
                  >
                    {[
                      'string',
                      'number',
                      'integer',
                      'object',
                      'array',
                      'boolean',
                    ]?.map((argumentType) => (
                      <Option key={argumentType} value={argumentType}>
                        {argumentType}
                      </Option>
                    ))}
                  </ControlledSelect>
                </Box>
                <ControlledSwitch
                  {...register(
                    // @ts-ignore
                    `${nestedField}.${nestIndex}.arguments.${index}.required`,
                  )}
                  disabled={false}
                  label={
                    <Text variant="subtitle1" component="span">
                      Required
                    </Text>
                  }
                />
              </div>
              <Button
                variant="borderless"
                className="h-10 self-end"
                color="error"
                onClick={() => remove(index)}
              >
                <TrashIcon className="h-4 w-4" />
              </Button>
            </div>
          </Box>
        ))}
      </div>
    </Box>
  );
}

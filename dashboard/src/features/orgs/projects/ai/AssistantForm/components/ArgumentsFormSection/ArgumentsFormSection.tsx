import { InfoIcon, PlusIcon, Trash2 as TrashIcon } from 'lucide-react';
import { type Path, useFieldArray, useFormContext } from 'react-hook-form';
import { ControlledSwitch } from '@/components/form/ControlledSwitch';
import { FormSelect } from '@/components/form/FormSelect';
import { Box } from '@/components/ui/v2/Box';
import { Input } from '@/components/ui/v2/Input';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { Button } from '@/components/ui/v3/button';
import { SelectItem } from '@/components/ui/v3/select';
import type { AssistantFormValues } from '@/features/orgs/projects/ai/AssistantForm/AssistantForm';

type AssistantFormPath = Path<AssistantFormValues>;

interface ArgumentsFormSectionProps {
  nestedField: 'graphql' | 'webhooks';
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
            <InfoIcon aria-label="Info" className="h-4 w-4 text-primary" />
          </Tooltip>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Add argument"
          onClick={() => append({})}
        >
          <PlusIcon className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex flex-col space-y-4">
        {fields.map((field, index) => {
          const argumentTypeName =
            `${nestedField}.${nestIndex}.arguments.${index}.type` as AssistantFormPath;

          return (
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
                    `${nestedField}.${nestIndex}.arguments.${index}.name`,
                  )}
                  id={`${field.id}-name`}
                  placeholder="Name"
                  className="w-full"
                  hideEmptyHelperText
                  error={
                    !!errors?.[nestedField]?.[nestIndex]?.arguments?.[index]
                      ?.name
                  }
                  helperText={
                    errors?.[nestedField]?.[nestIndex]?.arguments?.[index]?.name
                      ?.message
                  }
                  fullWidth
                  autoComplete="off"
                />

                <Input
                  {...register(
                    `${nestedField}.${nestIndex}.arguments.${index}.description`,
                  )}
                  id={`${field.id}-description`}
                  placeholder="Description"
                  className="w-full"
                  hideEmptyHelperText
                  error={
                    !!errors?.[nestedField]?.[nestIndex]?.arguments?.[index]
                      ?.description
                  }
                  helperText={
                    errors?.[nestedField]?.[nestIndex]?.arguments?.[index]
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
                    <FormSelect
                      control={form.control}
                      name={argumentTypeName}
                      placeholder="Select argument type"
                      containerClassName="space-y-0"
                      contentClassName="z-[10000] w-[270px] min-w-0"
                    >
                      {[
                        'string',
                        'number',
                        'integer',
                        'object',
                        'array',
                        'boolean',
                      ]?.map((argumentType) => (
                        <SelectItem key={argumentType} value={argumentType}>
                          {argumentType}
                        </SelectItem>
                      ))}
                    </FormSelect>
                  </Box>
                  <ControlledSwitch
                    {...register(
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
                  variant="ghost"
                  className="h-10 self-end text-destructive hover:text-destructive"
                  aria-label="Remove argument"
                  onClick={() => remove(index)}
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </div>
            </Box>
          );
        })}
      </div>
    </Box>
  );
}

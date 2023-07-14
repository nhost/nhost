import { ControlledSwitch } from '@/components/form/ControlledSwitch';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import { Input } from '@/components/ui/v2/Input';
import { Option } from '@/components/ui/v2/Option';
import { Select } from '@/components/ui/v2/Select';
import { Text } from '@/components/ui/v2/Text';
import type { CreateServiceFormValues } from '@/features/run/components/CreateServiceForm';
import { useFieldArray, useFormContext } from 'react-hook-form';

export default function PortsFormSection() {
  const {
    register,
    setValue,
    formState: { errors },
  } = useFormContext<CreateServiceFormValues>();

  const { fields, append, remove, update } = useFieldArray({
    name: 'ports',
  });

  return (
    <Box className="space-y-4 rounded border-1 p-4">
      <Box className="flex flex-row items-center justify-between ">
        <Text variant="h4" className="font-semibold">
          Ports
        </Text>
        <Button
          variant="borderless"
          onClick={() => append({ port: '', type: 'http', publish: false })}
        >
          <PlusIcon className="h-5 w-5" />
        </Button>
      </Box>

      <Box className="flex flex-col space-y-4">
        {fields.map((field, index) => (
          <Box key={field.id} className="flex w-full flex-row space-x-2">
            <Input
              {...register(`ports.${index}.port`)}
              id={`${field.id}-port`}
              placeholder="Port"
              className="w-full"
              hideEmptyHelperText
              error={!!errors?.ports?.at(index)}
              helperText={errors?.ports?.at(index)?.message}
              fullWidth
              autoComplete="off"
            />

            <Select
              fullWidth
              {...register(`ports.${index}.type`)}
              // onChange={(_event, inputValue) => onChange(inputValue as string)}
              placeholder="Select port type"
              slotProps={{
                listbox: { className: 'min-w-0 w-full' },
                popper: {
                  disablePortal: false,
                  className: 'z-[10000] w-[270px] w-full',
                },
              }}
            >
              {['http', 'tcp', 'udp']?.map((portType) => (
                <Option key={portType} value={portType}>
                  {portType}
                </Option>
              ))}
            </Select>

            <ControlledSwitch
              {...register(`ports.${index}.publish`)}
              disabled={false} // TODO turn off and disable if the port is not http
              name={`publish-port-${index}`}
              label={
                <Text variant="subtitle1" component="span">
                  Publish
                </Text>
              }
            />

            <Button
              variant="borderless"
              className=""
              color="error"
              onClick={() => remove(index)}
            >
              <TrashIcon className="h-4 w-4" />
            </Button>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import { Input } from '@/components/ui/v2/Input';
import { Option } from '@/components/ui/v2/Option';
import { Select } from '@/components/ui/v2/Select';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { inputBaseClasses } from '@mui/material';
import { useState } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import type { BaseRemoteSchemaFormValues } from './BaseRemoteSchemaForm';

export default function AdditionalHeadersEditor() {
  const form = useFormContext<BaseRemoteSchemaFormValues>();
  const [headerTypes, setHeaderTypes] = useState<
    Record<string, 'value' | 'value_from_env'>
  >({});

  const {
    register,
    setValue,
    formState: { errors },
  } = form;

  const { fields, append, remove } = useFieldArray({
    name: 'definition.headers',
  });

  const onChangeHeaderValueType = (
    valueType: 'value' | 'value_from_env',
    index: number,
    fieldId: string,
  ) => {
    // Clear both fields first, then the user will fill in the selected one
    setValue(`definition.headers.${index}.value`, '');
    setValue(`definition.headers.${index}.value_from_env`, '');

    // Update the state for this specific header
    setHeaderTypes((prev) => ({
      ...prev,
      [fieldId]: valueType,
    }));
  };

  const getHeaderValueType = (fieldId: string): 'value' | 'value_from_env' => {
    return headerTypes[fieldId] || 'value';
  };

  const handleRemoveHeader = (index: number, fieldId: string) => {
    // Clean up the state when removing a header
    setHeaderTypes((prev) => {
      const newState = { ...prev };
      delete newState[fieldId];
      return newState;
    });
    remove(index);
  };

  const valueTypeOptions = [
    { label: 'Value', value: 'value' as const },
    { label: 'Env Var', value: 'value_from_env' as const },
  ];

  return (
    <Box className="space-y-4 rounded border-1 p-4">
      <Box className="flex flex-row items-center justify-between">
        <Box className="flex flex-row items-center space-x-2">
          <Text variant="h4" className="font-semibold">
            Additional headers
          </Text>
          <Tooltip title="Custom headers to be sent to the remote GraphQL server">
            <InfoIcon aria-label="Info" className="h-4 w-4" color="primary" />
          </Tooltip>
        </Box>
        <Button
          variant="borderless"
          onClick={() => append({ name: '', value: '', value_from_env: '' })}
        >
          <PlusIcon className="h-5 w-5" />
        </Button>
      </Box>

      <Box className="flex flex-col space-y-4">
        {fields.length > 0 && (
          <Box className="grid grid-cols-8 gap-4">
            <Text className="col-span-3">Key</Text>
            <div className="col-span-1" />
            <Text className="col-span-3">Value</Text>
            <div className="col-span-1" />
          </Box>
        )}

        {fields.map((field, index) => {
          const currentValueType = getHeaderValueType(field.id);

          return (
            <Box key={field.id} className="grid grid-cols-8 items-center gap-4">
              <Input
                {...register(`definition.headers.${index}.name`)}
                id={`${field.id}-name`}
                placeholder="Header name"
                className="col-span-3"
                hideEmptyHelperText
                error={!!errors?.definition?.headers?.at(index)}
                helperText={errors?.definition?.headers?.at(index)?.message}
                fullWidth
                autoComplete="off"
              />

              <Text className="col-span-1 text-center">:</Text>

              <Box className="col-span-3 flex flex-col gap-1 md:flex-row md:gap-0">
                <Select
                  className="md:w-40"
                  value={currentValueType}
                  onChange={(_event, inputValue) =>
                    onChangeHeaderValueType(
                      inputValue as 'value' | 'value_from_env',
                      index,
                      field.id,
                    )
                  }
                  placeholder="Select value type"
                  slotProps={{
                    listbox: { className: 'min-w-0 w-full ' },
                    root: { className: 'rounded-r-none' },
                    popper: {
                      disablePortal: false,
                      className: 'z-[10000] w-[240px]',
                    },
                  }}
                >
                  {valueTypeOptions.map((valueType) => (
                    <Option key={valueType.value} value={valueType.value}>
                      {valueType.label}
                    </Option>
                  ))}
                </Select>
                <Input
                  {...register(
                    `definition.headers.${index}.${currentValueType}`,
                  )}
                  id={`${field.id}-${currentValueType}`}
                  className="pl-0"
                  sx={{
                    [`& .${inputBaseClasses.input}`]: {
                      paddingLeft: '4px',
                    },
                    borderLeft: 'none',
                    borderTopLeftRadius: 0,
                    borderBottomLeftRadius: 0,
                  }}
                  placeholder={
                    currentValueType === 'value'
                      ? 'Header value'
                      : 'Env var name'
                  }
                  hideEmptyHelperText
                  error={!!errors?.definition?.headers?.at(index)}
                  fullWidth
                  autoComplete="off"
                />
              </Box>

              <Button
                variant="borderless"
                className="col-span-1"
                color="error"
                onClick={() => handleRemoveHeader(index, field.id)}
              >
                <TrashIcon className="h-4 w-4" />
              </Button>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

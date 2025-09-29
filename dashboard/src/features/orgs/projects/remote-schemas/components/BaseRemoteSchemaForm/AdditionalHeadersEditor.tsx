import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { HelperText } from '@/components/ui/v2/HelperText';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import { Input } from '@/components/ui/v2/Input';
import { Option } from '@/components/ui/v2/Option';
import { Select } from '@/components/ui/v2/Select';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { inputBaseClasses } from '@mui/material';
import { useEffect, useState } from 'react';
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
    watch,
  } = form;

  const { fields, append, remove } = useFieldArray({
    name: 'definition.headers',
  });

  useEffect(() => {
    const currentHeaders = watch('definition.headers') || [];
    const initialHeaderTypes: Record<string, 'value' | 'value_from_env'> = {};

    fields.forEach((field, index) => {
      const header = currentHeaders[index];
      if (header) {
        if (header.value_from_env && !header.value) {
          initialHeaderTypes[field.id] = 'value_from_env';
        } else {
          initialHeaderTypes[field.id] = 'value';
        }
      } else {
        initialHeaderTypes[field.id] = 'value';
      }
    });

    setHeaderTypes(initialHeaderTypes);
  }, [fields, watch]);

  const onChangeHeaderValueType = (
    valueType: 'value' | 'value_from_env',
    index: number,
    fieldId: string,
  ) => {
    setValue(`definition.headers.${index}.value`, '');
    setValue(`definition.headers.${index}.value_from_env`, '');

    setHeaderTypes((prev) => ({
      ...prev,
      [fieldId]: valueType,
    }));
  };

  const getHeaderValueType = (fieldId: string): 'value' | 'value_from_env' =>
    headerTypes[fieldId] || 'value';

  const handleRemoveHeader = (index: number, fieldId: string) => {
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
          <Box className="grid grid-cols-9 gap-4">
            <Text className="col-span-3">Key</Text>
            <div className="col-span-1" />
            <Text className="col-span-4">Value</Text>
            <div className="col-span-1" />
          </Box>
        )}

        {fields.map((field, index) => {
          const currentValueType = getHeaderValueType(field.id);
          const headerErrors = errors?.definition?.headers?.at?.(index);
          const nameMessage = headerErrors?.name?.message;
          const objectLevelMessage =
            headerErrors?.message ?? headerErrors?.root?.message;
          const combinedMessage = nameMessage ?? objectLevelMessage;

          return (
            <Box key={field.id} className="grid grid-cols-9 items-center gap-4">
              {combinedMessage && (
                <HelperText className="col-span-9" error>
                  {combinedMessage}
                </HelperText>
              )}
              <Input
                {...register(`definition.headers.${index}.name`)}
                id={`${field.id}-name`}
                placeholder="Header name"
                className="col-span-3"
                hideEmptyHelperText
                error={Boolean(combinedMessage)}
                fullWidth
                autoComplete="off"
              />

              <Text className="col-span-1 text-center">:</Text>

              <Box className="col-span-4 flex flex-col gap-1 md:flex-row md:gap-0">
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
                      paddingLeft: '8px',
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
                  error={Boolean(combinedMessage)}
                  helperText=""
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

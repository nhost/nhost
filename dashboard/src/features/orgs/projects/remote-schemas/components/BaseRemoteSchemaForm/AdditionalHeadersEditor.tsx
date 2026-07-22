import { InfoIcon, PlusIcon, Trash2 as TrashIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { Button } from '@/components/ui/v3/button';
import { Input } from '@/components/ui/v3/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { cn } from '@/lib/utils';
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
    <div className="box space-y-4 rounded border-1 p-4">
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-row items-center space-x-2">
          <h4 className="font-semibold">Additional headers</h4>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Info"
                className="flex items-center"
              >
                <InfoIcon className="h-4 w-4 text-primary" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              Custom headers to be sent to the remote GraphQL server
            </TooltipContent>
          </Tooltip>
        </div>
        <Button
          aria-label="Add header"
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => append({ name: '', value: '', value_from_env: '' })}
        >
          <PlusIcon className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex flex-col space-y-4">
        {fields.length > 0 && (
          <div className="grid grid-cols-9 gap-4">
            <span className="col-span-3">Key</span>
            <div className="col-span-1" />
            <span className="col-span-4">Value</span>
            <div className="col-span-1" />
          </div>
        )}

        {fields.map((field, index) => {
          const currentValueType = getHeaderValueType(field.id);
          const headerErrors = errors?.definition?.headers?.at?.(index);
          const nameMessage = headerErrors?.name?.message;
          const objectLevelMessage =
            headerErrors?.message ?? headerErrors?.root?.message;
          const combinedMessage = nameMessage ?? objectLevelMessage;

          return (
            <div key={field.id} className="grid grid-cols-9 items-center gap-4">
              {combinedMessage && (
                <p className="col-span-9 text-destructive text-sm">
                  {combinedMessage}
                </p>
              )}
              <Input
                {...register(`definition.headers.${index}.name`)}
                id={`${field.id}-name`}
                placeholder="Header name"
                className={cn({ 'border-destructive': combinedMessage })}
                wrapperClassName="col-span-3"
                autoComplete="off"
              />

              <span className="col-span-1 text-center">:</span>

              <div className="col-span-4 flex flex-col gap-1 md:flex-row md:gap-0">
                <Select
                  value={currentValueType}
                  onValueChange={(value) =>
                    onChangeHeaderValueType(
                      value as 'value' | 'value_from_env',
                      index,
                      field.id,
                    )
                  }
                >
                  <SelectTrigger className="rounded-r-none md:w-40">
                    <SelectValue placeholder="Select value type" />
                  </SelectTrigger>
                  <SelectContent className="z-[10000] w-[240px] min-w-0">
                    {valueTypeOptions.map((valueType) => (
                      <SelectItem key={valueType.value} value={valueType.value}>
                        {valueType.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  {...register(
                    `definition.headers.${index}.${currentValueType}`,
                  )}
                  id={`${field.id}-${currentValueType}`}
                  placeholder={
                    currentValueType === 'value'
                      ? 'Header value'
                      : 'Env var name'
                  }
                  className={cn('md:rounded-l-none md:border-l-0', {
                    'border-destructive': combinedMessage,
                  })}
                  wrapperClassName="w-full"
                  autoComplete="off"
                />
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="col-span-1 text-destructive hover:text-destructive"
                aria-label="Remove header"
                onClick={() => handleRemoveHeader(index, field.id)}
              >
                <TrashIcon className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

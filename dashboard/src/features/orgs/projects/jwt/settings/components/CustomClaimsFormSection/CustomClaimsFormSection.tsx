import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import { Input } from '@/components/ui/v2/Input';
import { Text } from '@/components/ui/v2/Text';
import type { JWTSettingsFormValues } from '@/features/orgs/projects/jwt/settings/types';
import { useFieldArray, useFormContext } from 'react-hook-form';

export default function CustomClaimsFormSection() {
  const {
    register,
    formState: { errors },
    control,
  } = useFormContext<JWTSettingsFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'customClaims',
  });

  return (
    <Box className="flex flex-col gap-4">
      <Box className="flex flex-row items-center justify-between">
        <Box className="flex flex-col gap-1">
          <Text variant="h4" className="font-semibold">
            Custom Claims
          </Text>
          <Text color="secondary">
            You can attach extra information to your JWTs in the form of custom
            claims. These claims can be used for authorization purposes in your
            application.
          </Text>
        </Box>
        <Button
          variant="borderless"
          onClick={() => append({ key: '', value: '' })}
        >
          <PlusIcon className="h-5 w-5" />
        </Button>
      </Box>
      {fields?.length > 0 ? (
        <Box className="flex flex-col gap-12">
          {fields.map((field, index) => (
            <Box key={field.id} className="flex w-full items-center gap-2">
              <Box className="flex flex-1 flex-col gap-2">
                <Input
                  {...register(`customClaims.${index}.key`)}
                  id={`${field.id}-custom-claims-key`}
                  label="Key"
                  placeholder="Enter your key"
                  className="w-full"
                  hideEmptyHelperText
                  error={!!errors?.customClaims?.[index]?.key}
                  helperText={errors?.customClaims?.[index]?.key?.message}
                  fullWidth
                  autoComplete="off"
                />
                <Input
                  {...register(`customClaims.${index}.value`)}
                  id={`${field.id}-custom-claims-value`}
                  label="Value"
                  placeholder="Enter your value"
                  className="w-full"
                  hideEmptyHelperText
                  error={!!errors?.customClaims?.[index]?.value}
                  helperText={errors?.customClaims?.[index]?.value?.message}
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

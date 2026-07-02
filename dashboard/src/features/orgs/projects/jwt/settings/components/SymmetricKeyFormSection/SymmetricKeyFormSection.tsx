import { useFormContext } from 'react-hook-form';
import { Box } from '@/components/ui/v2/Box';
import { FormControl } from '@/components/ui/v2/FormControl';
import { Input } from '@/components/ui/v2/Input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import type { JWTSettingsFormValues } from '@/features/orgs/projects/jwt/settings/types';
import { SYMMETRIC_ALGORITHMS } from '@/features/orgs/projects/jwt/settings/utils/constants';

export default function SymmetricKeyFormSection() {
  const {
    register,
    formState: { errors },
    watch,
    setValue,
  } = useFormContext<JWTSettingsFormValues>();

  const type = watch('type');

  return (
    <Box className="grid grid-cols-5 gap-4">
      <FormControl
        className="col-span-5 lg:col-span-1"
        hideEmptyHelperText
        variant="normal"
        error={!!errors.type}
        helperText={errors?.type?.message}
        label="Hashing algorithm"
        labelProps={{ htmlFor: 'type' }}
      >
        <Select
          value={type ?? ''}
          onValueChange={(value) =>
            setValue('type', value, { shouldDirty: true })
          }
        >
          <SelectTrigger
            id="type"
            aria-invalid={!!errors.type}
            className="aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:border-red-500 aria-[invalid=true]:focus:ring-red-500"
          >
            <SelectValue placeholder={SYMMETRIC_ALGORITHMS[0]} />
          </SelectTrigger>
          <SelectContent>
            {SYMMETRIC_ALGORITHMS.map((algorithm) => (
              <SelectItem key={algorithm} value={algorithm}>
                {algorithm}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormControl>
      <Input
        {...register('key')}
        name="key"
        id="key"
        label="Key"
        placeholder="Enter symmetric key"
        className="col-span-5 lg:col-span-3"
        fullWidth
        hideEmptyHelperText
        error={!!errors?.key}
        helperText={errors?.key?.message}
      />
    </Box>
  );
}

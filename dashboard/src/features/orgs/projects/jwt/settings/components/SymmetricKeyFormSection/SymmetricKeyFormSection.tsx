import { Input } from '@/components/ui/v2/Input';
import { useFormContext } from 'react-hook-form';

import { Box } from '@/components/ui/v2/Box';
import { Option } from '@/components/ui/v2/Option';
import { Select } from '@/components/ui/v2/Select';
import {
  SYMMETRIC_ALGORITHMS,
  type JWTSettingsFormValues,
} from '@/features/orgs/projects/jwt/settings/types';

export default function SymmetricKeyFormSection() {
  const {
    register,
    formState: { errors },
    watch,
    setValue,
  } = useFormContext<JWTSettingsFormValues>();

  const type = watch('type');

  console.log('type:', type);

  return (
    <Box className="grid grid-cols-3 gap-4">
      <Select
        id="type"
        className="col-span-2"
        placeholder="HS256"
        hideEmptyHelperText
        variant="normal"
        defaultValue={SYMMETRIC_ALGORITHMS[0]}
        error={!!errors.type}
        helperText={errors?.type?.message}
        label="Hashing algorithm"
        value={type}
        onChange={(_event, value) =>
          setValue('type', value as string, { shouldDirty: true })
        }
      >
        {SYMMETRIC_ALGORITHMS.map((algorithm) => (
          <Option key={algorithm} value={algorithm}>
            {algorithm}
          </Option>
        ))}
      </Select>
      <Input
        {...register('key')}
        name="key"
        id="key"
        label="Key"
        placeholder="Enter symmetric key"
        className="col-span-2"
        fullWidth
        hideEmptyHelperText
        error={!!errors?.key}
        helperText={errors?.key?.message}
      />
    </Box>
  );
}

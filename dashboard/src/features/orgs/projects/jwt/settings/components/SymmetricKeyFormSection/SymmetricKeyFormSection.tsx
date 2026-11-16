import { useFormContext } from 'react-hook-form';
import { FormInput } from '@/components/form/FormInput';
import { FormSelect } from '@/components/form/FormSelect';
import { SelectItem } from '@/components/ui/v3/select';
import type { JWTSettingsFormValues } from '@/features/orgs/projects/jwt/settings/types';
import { SYMMETRIC_ALGORITHMS } from '@/features/orgs/projects/jwt/settings/utils/constants';

export default function SymmetricKeyFormSection() {
  const { control } = useFormContext<JWTSettingsFormValues>();

  return (
    <div className="grid grid-cols-5 gap-4">
      <FormSelect
        control={control}
        name="type"
        label="Hashing algorithm"
        placeholder={SYMMETRIC_ALGORITHMS[0]}
        containerClassName="col-span-5 lg:col-span-1"
      >
        {SYMMETRIC_ALGORITHMS.map((algorithm) => (
          <SelectItem key={algorithm} value={algorithm}>
            {algorithm}
          </SelectItem>
        ))}
      </FormSelect>
      <FormInput
        control={control}
        name="key"
        label="Key"
        placeholder="Enter symmetric key"
        containerClassName="col-span-5 lg:col-span-3"
      />
    </div>
  );
}

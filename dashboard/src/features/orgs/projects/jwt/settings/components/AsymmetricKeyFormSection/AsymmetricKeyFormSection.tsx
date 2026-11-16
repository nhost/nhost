import { useFormContext } from 'react-hook-form';
import { FormInput } from '@/components/form/FormInput';
import { FormSelect } from '@/components/form/FormSelect';
import { FormTextarea } from '@/components/form/FormTextarea';
import { SelectItem } from '@/components/ui/v3/select';
import type { JWTSettingsFormValues } from '@/features/orgs/projects/jwt/settings/types';
import { ASYMMETRIC_ALGORITHMS } from '@/features/orgs/projects/jwt/settings/utils/constants';

export default function AsymmetricKeyFormSection() {
  const { control } = useFormContext<JWTSettingsFormValues>();

  return (
    <div className="grid grid-cols-5 gap-4">
      <FormSelect
        control={control}
        name="type"
        label="Hashing algorithm"
        placeholder={ASYMMETRIC_ALGORITHMS[0]}
        containerClassName="col-span-5 lg:col-span-1"
      >
        {ASYMMETRIC_ALGORITHMS.map((algorithm) => (
          <SelectItem key={algorithm} value={algorithm}>
            {algorithm}
          </SelectItem>
        ))}
      </FormSelect>
      <FormInput
        control={control}
        name="kid"
        label="Key ID"
        placeholder="Enter unique key ID"
        containerClassName="col-span-5 lg:col-span-3"
      />

      <div className="col-span-5 lg:col-span-4">
        <FormTextarea
          control={control}
          name="key"
          label="Public Key"
          placeholder="-----BEGIN PUBLIC KEY-----"
          className="min-h-[130px] resize-y"
        />
      </div>
      <div className="col-span-5 lg:col-span-4">
        <FormTextarea
          control={control}
          name="signingKey"
          label="Signing key"
          placeholder="-----BEGIN PRIVATE KEY-----"
          className="min-h-[130px] resize-y"
        />
      </div>
    </div>
  );
}

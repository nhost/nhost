import { useFormContext } from 'react-hook-form';
import { FormInput } from '@/components/form/FormInput';
import { FormSelect } from '@/components/form/FormSelect';
import { FormTextarea } from '@/components/form/FormTextarea';
import { SelectItem } from '@/components/ui/v3/select';
import type {
  ExternalSigningType,
  JWTSettingsFormValues,
} from '@/features/orgs/projects/jwt/settings/types';
import { ASYMMETRIC_ALGORITHMS } from '@/features/orgs/projects/jwt/settings/utils/constants';

interface ExternalSigningFieldProps {
  externalSigningType: ExternalSigningType;
}

export default function ExternalSigningField({
  externalSigningType,
}: ExternalSigningFieldProps) {
  const { control } = useFormContext<JWTSettingsFormValues>();

  if (externalSigningType === 'jwk-endpoint') {
    return (
      <FormInput
        control={control}
        name="jwkUrl"
        placeholder="https://acme.com/jwks.json"
        containerClassName="col-span-5 lg:col-span-4"
        label="JWK URL"
      />
    );
  }

  if (externalSigningType === 'public-key') {
    return (
      <>
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
        <div className="lg:col-span-4" />

        <div className="col-span-5 lg:col-span-4">
          <FormTextarea
            control={control}
            name="key"
            placeholder="-----BEGIN PUBLIC KEY-----"
            label="Public Key"
            className="min-h-[130px] resize-y"
          />
        </div>
      </>
    );
  }

  return null;
}

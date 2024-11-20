import * as Yup from 'yup';

export type JWTSecretType = 'symmetric' | 'asymmetric' | 'third-party';

export const SYMMETRIC_ALGORITHMS = ['HS256', 'HS384', 'HS512'] as const;

export const ASYMMETRIC_ALGORITHMS = ['RS256', 'RS384', 'RS512'] as const;

export const validationSchema = Yup.object({
  type: Yup.string()
    .label('Type')
    .when('$signatureType', {
      is: (signatureType: JWTSecretType) => signatureType !== 'third-party',
      then: (schema) => schema.required(),
    }),
  key: Yup.string()
    .label('Key')
    .when('$signatureType', {
      is: (signatureType: JWTSecretType) => signatureType !== 'third-party',
      then: (schema) => schema.required(),
    }),
  signingKey: Yup.string()
    .label('Signing key')
    .when('$signatureType', {
      is: (signatureType: JWTSecretType) => signatureType === 'asymmetric',
      then: (schema) => schema.required(),
    }),
  kid: Yup.string().label('Key ID'),
  jwkUrl: Yup.string()
    .label('JWK endpoint URL')
    .url()
    .when('$signatureType', {
      is: (signatureType: JWTSecretType) => signatureType === 'third-party',
      then: (schema) => schema.required(),
    }),
  customClaims: Yup.array().of(
    Yup.object({
      key: Yup.string().label('Key'),
      value: Yup.string().label('Value'),
    }),
  ),
});

export type JWTSettingsFormValues = Yup.InferType<typeof validationSchema>;

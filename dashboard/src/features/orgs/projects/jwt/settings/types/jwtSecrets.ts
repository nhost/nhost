import * as Yup from 'yup';

export type JWTSecretType = 'symmetric' | 'asymmetric' | 'third-party';

export const validationSchema = Yup.object({
  type: Yup.string().label('Type'),
  key: Yup.string().label('Key'),
  signingKey: Yup.string().label('Signing key'),
  kid: Yup.string().label('Key ID'),
  jwkUrl: Yup.string().label('JWK URL'),
  customClaims: Yup.array().of(
    Yup.object({
      key: Yup.string().label('Key'),
      value: Yup.string().label('Value'),
    }),
  ),
});

export type JWTSettingsFormValues = Yup.InferType<typeof validationSchema>;

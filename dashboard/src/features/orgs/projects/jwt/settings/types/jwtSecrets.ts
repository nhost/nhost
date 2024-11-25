import * as Yup from 'yup';

export type JWTSecretType = 'symmetric' | 'asymmetric' | 'external';

export type ExternalSigningType = 'jwk-endpoint' | 'public-key';

export const validationSchema = Yup.object({
  type: Yup.string()
    .label('Type')
    .when(['$signatureType', '$externalSigningType'], {
      is: (
        signatureType: JWTSecretType,
        externalSigningType: ExternalSigningType,
      ) => {
        if (signatureType === 'external') {
          return externalSigningType === 'public-key';
        }
        return true;
      },
      then: (schema) => schema.required(),
    }),
  key: Yup.string()
    .label('Key')
    .when(['$signatureType', '$externalSigningType'], {
      is: (
        signatureType: JWTSecretType,
        externalSigningType: ExternalSigningType,
      ) => {
        if (signatureType === 'external') {
          return externalSigningType === 'public-key';
        }
        return true;
      },
      then: (schema) => schema.required(),
    }),
  signingKey: Yup.string()
    .label('Signing key')
    .when('$signatureType', {
      is: (signatureType: JWTSecretType) => signatureType === 'asymmetric',
      then: (schema) => schema.required(),
    }),
  kid: Yup.string()
    .label('Key ID')
    .when('$signatureType', {
      is: (signatureType: JWTSecretType) => signatureType === 'asymmetric',
      then: (schema) => schema.required(),
    }),
  jwkUrl: Yup.string()
    .label('JWK endpoint URL')
    .url()
    .when(['$signatureType', '$externalSigningType'], {
      is: (
        signatureType: JWTSecretType,
        externalSigningType: ExternalSigningType,
      ) =>
        signatureType === 'external' && externalSigningType === 'jwk-endpoint',
      then: (schema) => schema.required(),
    }),
});

export type JWTSettingsFormValues = Yup.InferType<typeof validationSchema>;

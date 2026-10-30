import { baseSecretFormValidationSchema } from './BaseSecretForm';

describe('baseSecretFormValidationSchema', () => {
  it('accepts an empty value', async () => {
    await expect(
      baseSecretFormValidationSchema.validate({ name: 'MY_SECRET', value: '' }),
    ).resolves.toEqual({ name: 'MY_SECRET', value: '' });
  });

  it('accepts a name and a value', async () => {
    await expect(
      baseSecretFormValidationSchema.validate({
        name: 'MY_SECRET',
        value: 'abc',
      }),
    ).resolves.toEqual({ name: 'MY_SECRET', value: 'abc' });
  });
});

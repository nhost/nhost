import { describe, expect, it } from 'vitest';
import { baseSecretFormValidationSchema } from './BaseSecretForm';

describe('baseSecretFormValidationSchema', () => {
  it('rejects an empty value, so saving never wipes a secret', async () => {
    await expect(
      baseSecretFormValidationSchema.validate({ name: 'MY_SECRET', value: '' }),
    ).rejects.toThrow('Enter a value.');
  });

  it('rejects a value with only spaces', async () => {
    await expect(
      baseSecretFormValidationSchema.validate({
        name: 'MY_SECRET',
        value: '   ',
      }),
    ).rejects.toThrow('Enter a value.');
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

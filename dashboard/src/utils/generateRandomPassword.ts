import generator from 'generate-password';
import * as yup from 'yup';
import YupPassword from 'yup-password';

YupPassword(yup);

/**
 * It generates a random password with a length of 28 characters, containing numbers, symbols,
 * lowercase and uppercase letters, and excludes similar characters.
 * @returns A random password
 */
export function generateRandomPassword() {
  return generator.generate({
    length: 16,
    numbers: true,
    lowercase: true,
    uppercase: true,
    symbols: false,
    strict: true,
    excludeSimilarCharacters: true,
  });
}

/* Defining a schema for the password. */
export const schema = yup.object().shape({
  'Database Password': yup
    .string()
    .min(12)
    .max(32)
    .required()
    .minNumbers(1)
    .minLowercase(1)
    .minUppercase(1),
});

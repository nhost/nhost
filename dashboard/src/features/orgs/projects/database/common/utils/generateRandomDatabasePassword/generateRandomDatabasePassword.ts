import generator from 'generate-password';

/**
 * It generates a random password with a length of 28 characters, containing numbers, symbols,
 * lowercase and uppercase letters, and excludes similar characters.
 * @returns A random password
 */
export default function generateRandomDatabasePassword() {
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

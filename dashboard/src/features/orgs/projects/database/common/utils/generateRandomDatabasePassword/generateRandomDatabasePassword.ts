// Look-alike characters (i, l, L, I, o, O, 0) are left out.
const LOWERCASE = 'abcdefghjkmnpqrstuvwxyz';
const UPPERCASE = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const NUMBERS = '123456789';
const ALL_CHARACTERS = LOWERCASE + UPPERCASE + NUMBERS;
const PASSWORD_LENGTH = 16;

/**
 * Returns a uniformly random index below `max`, using Web Crypto. Values
 * from the top of the 32-bit range that would bias the result are drawn
 * again.
 */
function randomIndex(max: number) {
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const value = new Uint32Array(1);

  do {
    crypto.getRandomValues(value);
  } while (value[0] >= limit);

  return value[0] % max;
}

/**
 * It generates a random 16-character password from lowercase and uppercase
 * letters and numbers, with at least one of each, and without characters
 * that look alike.
 * @returns A random password
 */
export default function generateRandomDatabasePassword() {
  let password = '';

  do {
    password = Array.from(
      { length: PASSWORD_LENGTH },
      () => ALL_CHARACTERS[randomIndex(ALL_CHARACTERS.length)],
    ).join('');
  } while (
    ![LOWERCASE, UPPERCASE, NUMBERS].every((characters) =>
      [...password].some((character) => characters.includes(character)),
    )
  );

  return password;
}

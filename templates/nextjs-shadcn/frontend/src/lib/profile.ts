/**
 * Whether an account's profile is visible to strangers.
 *
 * Public unless its owner has turned it off. The *absence* of the flag means
 * public, which is the whole point: a scaffolded project has a working
 * `/u/<id>` the moment somebody signs in, instead of a feature that silently
 * does nothing until you find a switch on another page. Turning it off is the
 * deliberate act, and it writes `publicProfile: false`.
 *
 * This is the frontend half of a rule the database enforces independently. The
 * `public` role's filters in `backend/nhost/metadata/` say the same thing as
 * `_not: { metadata: { _contains: { publicProfile: false } } }`, and they are
 * what actually decides who can read a row - this only decides what the UI
 * offers. Change one and the other has to move with it.
 *
 * Note the asymmetry with SQL: a fresh account's `metadata` is JSON `null`
 * rather than SQL NULL (Nhost auth marshals an absent value to the literal
 * `null`), and `'null'::jsonb @> '...'` is false rather than NULL, so the
 * database agrees with the `null` case below. Were a row ever to hold SQL NULL
 * the database would read it as *private* while this reads it as public - a
 * disagreement that fails closed, which is the right way round for it to fail.
 */
export function isProfilePublic(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return true;
  }

  return (metadata as { publicProfile?: unknown }).publicProfile !== false;
}

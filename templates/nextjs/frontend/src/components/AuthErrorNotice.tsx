type Param = string | string[] | undefined;

const first = (value: Param): string | undefined =>
  Array.isArray(value) ? value[0] : value;

/**
 * Says why an auth redirect failed.
 *
 * Auth emails and the OAuth buttons send the browser to the auth service, and
 * when that fails it redirects back to `redirectTo` with `error` and
 * `errorDescription` in the query. An expired link, a provider that is not
 * enabled in `nhost.toml`, a callback the provider refused: all land on the
 * page the flow would have landed on anyway, and without this nothing would
 * say what went wrong.
 */
export default function AuthErrorNotice({
  error,
  description,
}: {
  error: Param;
  description: Param;
}) {
  const code = first(error);
  if (!code) {
    return null;
  }

  return (
    <p
      role="alert"
      className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-destructive text-sm"
    >
      {first(description) || 'Sign-in failed.'}{' '}
      <span className="font-mono text-xs">({code})</span>
    </p>
  );
}

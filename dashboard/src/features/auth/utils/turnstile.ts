export function isTurnstileEnabled(): boolean {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  return (
    process.env.NODE_ENV !== 'development' &&
    Boolean(siteKey) &&
    siteKey !== 'FIXME'
  );
}

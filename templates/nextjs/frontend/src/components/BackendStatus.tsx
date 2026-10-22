import {
  dashboardURL,
  isLocalBackend,
  nhostRegion,
  nhostSubdomain,
} from '@/lib/nhost/env';

/**
 * Which backend this build talks to, with a link to manage it.
 *
 * The answer was fixed when `next build` ran (see `env.ts`), so a deploy that
 * forgot its NEXT_PUBLIC_NHOST_* variables shows up here as a local backend
 * rather than as sign-ins that fail for no visible reason.
 */
export default function BackendStatus() {
  const local = isLocalBackend();

  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-sm">
      <span
        aria-hidden="true"
        className={`size-2 rounded-full ${local ? 'bg-amber-400' : 'bg-emerald-400'}`}
      />
      {local ? (
        <span>Connected to the local backend</span>
      ) : (
        <span>
          Connected to Nhost Cloud project{' '}
          <code className="font-mono text-foreground">{nhostSubdomain()}</code>{' '}
          in {nhostRegion()}
        </span>
      )}
      <span aria-hidden="true">·</span>
      <a
        href={dashboardURL()}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-foreground underline-offset-4 hover:underline"
      >
        Dashboard <span aria-hidden="true">↗</span>
      </a>
    </p>
  );
}

import {
  dashboardURL,
  isLocalBackend,
  nhostRegion,
  nhostSubdomain,
} from '@/lib/nhost/env';

/**
 * Which backend this build talks to, linking to where it is managed.
 *
 * The answer was fixed when `next build` ran (see `env.ts`), so a deploy that
 * forgot its NEXT_PUBLIC_NHOST_* variables shows up here as local rather than
 * as sign-ins that fail for no visible reason. A cloud link carries the
 * project's subdomain in its title, for picking the project on the dashboard.
 */
export default function BackendStatus() {
  const local = isLocalBackend();

  return (
    <span className="flex items-center gap-2 text-muted-foreground">
      <span aria-hidden="true" className="size-2 rounded-full bg-emerald-400" />
      <span>
        Connected:{' '}
        <a
          href={dashboardURL()}
          target="_blank"
          rel="noreferrer"
          title={local ? undefined : `${nhostSubdomain()} in ${nhostRegion()}`}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {local ? 'Nhost Local' : 'Nhost Cloud'}{' '}
          <span aria-hidden="true">↗</span>
        </a>
      </span>
    </span>
  );
}

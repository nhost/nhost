export function cronJobsPath(
  orgSlug: string | string[] | undefined,
  appSubdomain: string | string[] | undefined,
) {
  return `/orgs/${orgSlug}/projects/${appSubdomain}/events/cron-jobs`;
}

export function webhookJobPath(basePath: string, name: string) {
  return `${basePath}/webhook/${encodeURIComponent(name)}`;
}

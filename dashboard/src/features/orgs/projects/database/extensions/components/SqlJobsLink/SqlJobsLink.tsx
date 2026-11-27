import { CalendarClock } from 'lucide-react';
import { useRouter } from 'next/router';
import { TextLink } from '@/components/ui/v3/text-link';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

export default function SqlJobsLink() {
  const { query } = useRouter();
  const orgSlug = getSingleQueryParam(query.orgSlug);
  const appSubdomain = getSingleQueryParam(query.appSubdomain);
  if (!orgSlug || !appSubdomain || query.dataSourceSlug !== 'default') {
    return null;
  }
  return (
    <TextLink
      href={`/orgs/${orgSlug}/projects/${appSubdomain}/events/cron-jobs`}
      className="inline-flex items-center gap-1.5 text-sm"
    >
      <CalendarClock className="size-4" aria-hidden />
      Manage cron jobs
    </TextLink>
  );
}

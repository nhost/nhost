import { CalendarClock } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Button } from '@/components/ui/v3/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

export default function SqlJobsLink() {
  const { query } = useRouter();
  const orgSlug = getSingleQueryParam(query.orgSlug);
  const appSubdomain = getSingleQueryParam(query.appSubdomain);
  if (!orgSlug || !appSubdomain || query.dataSourceSlug !== 'default') {
    return null;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          asChild
          variant="ghost"
          size="icon-xs"
          className="-my-0.5 shrink-0"
        >
          <Link
            href={`/orgs/${orgSlug}/projects/${appSubdomain}/events/sql-jobs`}
          >
            <CalendarClock
              className="size-4 text-muted-foreground"
              aria-hidden
            />
            <span className="sr-only">Manage SQL jobs</span>
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent>Manage SQL jobs</TooltipContent>
    </Tooltip>
  );
}

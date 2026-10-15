import { createFileRoute } from '@tanstack/react-router';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { ServerlessFunctionView } from '@/features/orgs/projects/serverless-functions/components/ServerlessFunctionView';
import {
  type FunctionTab,
  isFunctionTab,
} from '@/features/orgs/projects/serverless-functions/types';
import { getSearchParam } from '@/lib/search-params';

interface FunctionDetailsSearch {
  tab?: FunctionTab;
  /** Metrics panel opened in a dialog. */
  metricPanel?: string;
  /** Series hidden in the open metrics panel, comma-separated. */
  metricHidden?: string;
  metricRange?: string;
  metricFrom?: string;
  metricTo?: string;
}

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/functions/browser/$',
)({
  validateSearch: (search): FunctionDetailsSearch => {
    const tab = getSearchParam(search.tab);

    return {
      tab: isFunctionTab(tab) ? tab : undefined,
      metricPanel: getSearchParam(search.metricPanel),
      metricHidden: getSearchParam(search.metricHidden),
      metricRange: getSearchParam(search.metricRange),
      metricFrom: getSearchParam(search.metricFrom),
      metricTo: getSearchParam(search.metricTo),
    };
  },
  component: FunctionDetailsPage,
});

function FunctionDetailsPage() {
  const { _splat: slug } = Route.useParams();

  return (
    <RetryableErrorBoundary>
      <ServerlessFunctionView key={slug} />
    </RetryableErrorBoundary>
  );
}

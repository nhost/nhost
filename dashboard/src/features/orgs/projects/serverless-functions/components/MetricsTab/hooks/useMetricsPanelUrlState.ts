import { useRouter } from 'next/router';
import { useCallback, useMemo } from 'react';
import { METRIC_PANELS } from '@/features/orgs/projects/serverless-functions/components/MetricsTab/panels';
import {
  isMetricPanelSlug,
  type MetricPanelFilter,
  type MetricPanelSlug,
} from '@/features/orgs/projects/serverless-functions/components/MetricsTab/types';

const FILTER_PREFIX = 'metricFilter.';

export interface MetricsPanelUrlState {
  openPanel: MetricPanelSlug | null;
  filter: MetricPanelFilter;
  open: (slug: MetricPanelSlug) => void;
  close: () => void;
  setFilter: (filter: MetricPanelFilter) => void;
}

export default function useMetricsPanelUrlState(): MetricsPanelUrlState {
  const router = useRouter();

  const openPanel = useMemo(() => {
    const raw = router.query.metricPanel;
    const value = Array.isArray(raw) ? raw[0] : raw;
    return isMetricPanelSlug(value) ? value : null;
  }, [router.query.metricPanel]);

  const filter = useMemo<MetricPanelFilter>(() => {
    if (!openPanel) {
      return {};
    }
    const allowedDims = new Set(METRIC_PANELS[openPanel].labelDimensions);
    const result: MetricPanelFilter = {};
    Object.entries(router.query).forEach(([key, value]) => {
      if (!key.startsWith(FILTER_PREFIX)) {
        return;
      }
      const dim = key.slice(FILTER_PREFIX.length);
      if (!allowedDims.has(dim)) {
        return;
      }
      const raw = Array.isArray(value) ? value.join(',') : (value ?? '');
      const values = raw
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      if (values.length > 0) {
        result[dim] = values;
      }
    });
    return result;
  }, [openPanel, router.query]);

  const pushQuery = useCallback(
    (nextQuery: Record<string, string | string[] | undefined>) => {
      router.replace(
        { pathname: router.pathname, query: nextQuery },
        undefined,
        { shallow: true, scroll: false },
      );
    },
    [router],
  );

  const open = useCallback(
    (slug: MetricPanelSlug) => {
      const next = stripFilterKeys(router.query);
      next.metricPanel = slug;
      pushQuery(next);
    },
    [router.query, pushQuery],
  );

  const close = useCallback(() => {
    const next = stripFilterKeys(router.query);
    delete next.metricPanel;
    pushQuery(next);
  }, [router.query, pushQuery]);

  const setFilter = useCallback(
    (nextFilter: MetricPanelFilter) => {
      if (!openPanel) {
        return;
      }
      const allowedDims = new Set(METRIC_PANELS[openPanel].labelDimensions);
      const next = stripFilterKeys(router.query);
      next.metricPanel = openPanel;
      Object.entries(nextFilter).forEach(([dim, values]) => {
        if (!allowedDims.has(dim) || !values || values.length === 0) {
          return;
        }
        next[`${FILTER_PREFIX}${dim}`] = values.join(',');
      });
      pushQuery(next);
    },
    [openPanel, router.query, pushQuery],
  );

  return { openPanel, filter, open, close, setFilter };
}

function stripFilterKeys(
  query: Record<string, string | string[] | undefined>,
): Record<string, string | string[] | undefined> {
  const next: Record<string, string | string[] | undefined> = {};
  Object.entries(query).forEach(([key, value]) => {
    if (key.startsWith(FILTER_PREFIX)) {
      return;
    }
    next[key] = value;
  });
  return next;
}

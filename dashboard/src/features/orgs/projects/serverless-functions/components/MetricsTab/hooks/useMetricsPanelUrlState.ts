import { useRouter } from 'next/router';
import { useCallback, useMemo } from 'react';
import {
  isMetricPanelSlug,
  type MetricPanelSlug,
} from '@/features/orgs/projects/serverless-functions/components/MetricsTab/panels';

const HIDDEN_KEYS_PARAM = 'metricHidden';

export interface MetricsPanelUrlState {
  openPanel: MetricPanelSlug | null;
  hiddenKeys: string[];
  open: (slug: MetricPanelSlug) => void;
  close: () => void;
  setHiddenKeys: (next: string[]) => void;
}

export default function useMetricsPanelUrlState(): MetricsPanelUrlState {
  const router = useRouter();

  const rawPanel = router.query.metricPanel;
  const panelParam = Array.isArray(rawPanel) ? rawPanel[0] : rawPanel;
  const openPanel = isMetricPanelSlug(panelParam) ? panelParam : null;

  const hiddenKeys = useMemo<string[]>(() => {
    if (!openPanel) {
      return [];
    }
    const raw = router.query[HIDDEN_KEYS_PARAM];
    const value = Array.isArray(raw) ? raw.join(',') : (raw ?? '');
    return value
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
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
      const next = stripDialogKeys(router.query);
      next.metricPanel = slug;
      pushQuery(next);
    },
    [router.query, pushQuery],
  );

  const close = useCallback(() => {
    const next = stripDialogKeys(router.query);
    delete next.metricPanel;
    pushQuery(next);
  }, [router.query, pushQuery]);

  const setHiddenKeys = useCallback(
    (nextHidden: string[]) => {
      if (!openPanel) {
        return;
      }
      const next = stripDialogKeys(router.query);
      next.metricPanel = openPanel;
      if (nextHidden.length > 0) {
        next[HIDDEN_KEYS_PARAM] = nextHidden.join(',');
      }
      pushQuery(next);
    },
    [openPanel, router.query, pushQuery],
  );

  return { openPanel, hiddenKeys, open, close, setHiddenKeys };
}

function stripDialogKeys(
  query: Record<string, string | string[] | undefined>,
): Record<string, string | string[] | undefined> {
  const next: Record<string, string | string[] | undefined> = {};
  Object.entries(query).forEach(([key, value]) => {
    if (key === HIDDEN_KEYS_PARAM) {
      return;
    }
    next[key] = value;
  });
  return next;
}

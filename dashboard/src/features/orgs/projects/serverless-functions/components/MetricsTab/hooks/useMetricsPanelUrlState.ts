import { useNavigate, useSearch } from '@tanstack/react-router';
import { useCallback, useMemo } from 'react';
import {
  isMetricPanelSlug,
  type MetricPanelSlug,
} from '@/features/orgs/projects/serverless-functions/components/MetricsTab/panels';

const functionRoute =
  '/orgs/$orgSlug/projects/$appSubdomain/functions/browser/$';

export interface MetricsPanelUrlState {
  openPanel: MetricPanelSlug | null;
  hiddenKeys: string[];
  open: (slug: MetricPanelSlug) => void;
  close: () => void;
  setHiddenKeys: (next: string[]) => void;
}

/**
 * The open metrics panel (`metricPanel`) and its hidden series
 * (`metricHidden`) live in the URL. Opening or closing a panel resets the
 * hidden series.
 */
export default function useMetricsPanelUrlState(): MetricsPanelUrlState {
  const navigate = useNavigate({ from: functionRoute });
  const { metricPanel, metricHidden } = useSearch({ from: functionRoute });

  const openPanel = isMetricPanelSlug(metricPanel) ? metricPanel : null;

  const hiddenKeys = useMemo<string[]>(() => {
    if (!openPanel) {
      return [];
    }
    return (metricHidden ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }, [openPanel, metricHidden]);

  const replaceSearch = useCallback(
    (panel: MetricPanelSlug | undefined, hidden: string[] = []) => {
      navigate({
        search: (prev) => ({
          ...prev,
          metricPanel: panel,
          metricHidden: hidden.length > 0 ? hidden.join(',') : undefined,
        }),
        replace: true,
        resetScroll: false,
      });
    },
    [navigate],
  );

  const open = useCallback(
    (slug: MetricPanelSlug) => replaceSearch(slug),
    [replaceSearch],
  );

  const close = useCallback(() => replaceSearch(undefined), [replaceSearch]);

  const setHiddenKeys = useCallback(
    (nextHidden: string[]) => {
      if (!openPanel) {
        return;
      }
      replaceSearch(openPanel, nextHidden);
    },
    [openPanel, replaceSearch],
  );

  return { openPanel, hiddenKeys, open, close, setHiddenKeys };
}

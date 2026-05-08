import { dequal } from 'dequal';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  findFreeSlot,
  makeId,
} from '@/features/orgs/projects/overview/dashboard/findFreeSlot';
import type { CatalogEntry } from '@/features/orgs/projects/overview/dashboard/registry';
import {
  dismissFirstTime as dismissFirstTimeStorage,
  isFirstTimeDismissed,
  loadLayout,
  saveLayout,
} from '@/features/orgs/projects/overview/dashboard/storage';
import {
  DEFAULT_LAYOUT,
  GRID_COLS,
} from '@/features/orgs/projects/overview/dashboard/templates';
import type {
  DashboardLayout,
  LayoutItem,
  WidgetConfig,
} from '@/features/orgs/projects/overview/dashboard/types';

type UseDashboardLayoutResult = {
  layout: DashboardLayout;
  savedLayout: DashboardLayout;
  editing: boolean;
  dirty: boolean;
  hasSavedLayout: boolean;
  firstTimeDismissed: boolean;
  setLayout: (layout: DashboardLayout) => void;
  startEditing: () => void;
  save: VoidFunction;
  discard: VoidFunction;
  applyTemplate: (layout: DashboardLayout) => void;
  addWidget: (entry: CatalogEntry, slot?: { x: number; y: number }) => void;
  removeWidget: (id: string) => void;
  updateWidgetConfig: (id: string, cfg: Partial<WidgetConfig>) => void;
  dismissFirstTime: VoidFunction;
};

export function useDashboardLayout(
  subdomain: string | undefined,
): UseDashboardLayoutResult {
  const router = useRouter();

  const [savedLayout, setSavedLayout] =
    useState<DashboardLayout>(DEFAULT_LAYOUT);
  const [layout, setLayoutState] = useState<DashboardLayout>(DEFAULT_LAYOUT);
  const [editing, setEditing] = useState(false);
  const [hasSavedLayout, setHasSavedLayout] = useState(false);
  const [firstTimeDismissed, setFirstTimeDismissed] = useState(true);

  useEffect(() => {
    if (!subdomain) {
      return;
    }
    const stored = loadLayout(subdomain);
    const initial = stored ?? DEFAULT_LAYOUT;
    setSavedLayout(initial);
    setLayoutState(initial);
    setHasSavedLayout(stored !== null);
    setFirstTimeDismissed(isFirstTimeDismissed(subdomain));
  }, [subdomain]);

  const dirty = useMemo(
    () => !dequal(layout, savedLayout),
    [layout, savedLayout],
  );

  useEffect(() => {
    if (!editing || !dirty) {
      return;
    }

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // biome-ignore lint/style/noParameterAssign: required to trigger browser leave-prompt in legacy browsers
      e.returnValue = '';
    };

    const onRouteChangeStart = (url: string) => {
      const confirmed = window.confirm(
        'You have unsaved layout changes. Leave anyway?',
      );
      if (!confirmed) {
        router.events.emit('routeChangeError');
        // biome-ignore lint/suspicious/noExplicitAny: Next router throws to abort
        throw `Route change to ${url} aborted by user.` as any;
      }
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    router.events.on('routeChangeStart', onRouteChangeStart);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      router.events.off('routeChangeStart', onRouteChangeStart);
    };
  }, [editing, dirty, router.events]);

  const setLayout = useCallback((next: DashboardLayout) => {
    setLayoutState(next);
  }, []);

  const startEditing = useCallback(() => setEditing(true), []);

  const save = useCallback(() => {
    if (!subdomain) {
      return;
    }
    saveLayout(subdomain, layout);
    setSavedLayout(layout);
    setHasSavedLayout(true);
    setEditing(false);
  }, [subdomain, layout]);

  const discard = useCallback(() => {
    setLayoutState(savedLayout);
    setEditing(false);
  }, [savedLayout]);

  const applyTemplate = useCallback((next: DashboardLayout) => {
    setLayoutState(next);
  }, []);

  const addWidget = useCallback(
    (entry: CatalogEntry, slot?: { x: number; y: number }) => {
      setLayoutState((current) => {
        const where =
          slot ??
          findFreeSlot(
            current,
            GRID_COLS,
            entry.defaultSize.w,
            entry.defaultSize.h,
          );
        const item: LayoutItem = {
          i: makeId(entry.type),
          type: entry.type,
          cfg: { ...entry.cfg },
          x: where.x,
          y: where.y,
          w: entry.defaultSize.w,
          h: entry.defaultSize.h,
          minW: entry.defaultSize.minW,
          minH: entry.defaultSize.minH,
        };
        return [...current, item];
      });
    },
    [],
  );

  const removeWidget = useCallback((id: string) => {
    setLayoutState((current) => current.filter((it) => it.i !== id));
  }, []);

  const updateWidgetConfig = useCallback(
    (id: string, cfg: Partial<WidgetConfig>) => {
      setLayoutState((current) =>
        current.map((it) =>
          it.i === id ? { ...it, cfg: { ...it.cfg, ...cfg } } : it,
        ),
      );
    },
    [],
  );

  const dismissFirstTime = useCallback(() => {
    if (!subdomain) {
      return;
    }
    dismissFirstTimeStorage(subdomain);
    setFirstTimeDismissed(true);
  }, [subdomain]);

  return {
    layout,
    savedLayout,
    editing,
    dirty,
    hasSavedLayout,
    firstTimeDismissed,
    setLayout,
    startEditing,
    save,
    discard,
    applyTemplate,
    addWidget,
    removeWidget,
    updateWidgetConfig,
    dismissFirstTime,
  };
}

import { dequal } from 'dequal';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  findFreeSlot,
  makeId,
} from '@/features/orgs/projects/overview/dashboard/findFreeSlot';
import { WIDGET_TYPES } from '@/features/orgs/projects/overview/dashboard/registry';
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
  WidgetType,
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
  addWidget: (type: WidgetType, slot?: { x: number; y: number }) => void;
  removeWidget: (id: string) => void;
  updateWidgetConfig: (id: string, cfg: Partial<WidgetConfig>) => void;
  dismissFirstTime: VoidFunction;
};

export function useDashboardLayout(
  projectId: string | undefined,
): UseDashboardLayoutResult {
  const router = useRouter();

  const [savedLayout, setSavedLayout] =
    useState<DashboardLayout>(DEFAULT_LAYOUT);
  const [layout, setLayoutState] = useState<DashboardLayout>(DEFAULT_LAYOUT);
  const [editing, setEditing] = useState(false);
  const [hasSavedLayout, setHasSavedLayout] = useState(false);
  const [firstTimeDismissed, setFirstTimeDismissed] = useState(true);

  useEffect(() => {
    if (!projectId) {
      return;
    }
    const stored = loadLayout(projectId);
    const initial = stored ?? DEFAULT_LAYOUT;
    setSavedLayout(initial);
    setLayoutState(initial);
    setHasSavedLayout(stored !== null);
    setFirstTimeDismissed(isFirstTimeDismissed(projectId));
  }, [projectId]);

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
    if (!projectId) {
      return;
    }
    saveLayout(projectId, layout);
    setSavedLayout(layout);
    setHasSavedLayout(true);
    setEditing(false);
  }, [projectId, layout]);

  const discard = useCallback(() => {
    setLayoutState(savedLayout);
    setEditing(false);
  }, [savedLayout]);

  const applyTemplate = useCallback((next: DashboardLayout) => {
    setLayoutState(next);
  }, []);

  const addWidget = useCallback(
    (type: WidgetType, slot?: { x: number; y: number }) => {
      const meta = WIDGET_TYPES[type];
      setLayoutState((current) => {
        const where =
          slot ??
          findFreeSlot(current, GRID_COLS, meta.default.w, meta.default.h);
        const item: LayoutItem = {
          i: makeId(type),
          type,
          cfg: type === 'docs' ? { variant: 'frameworks' } : {},
          x: where.x,
          y: where.y,
          w: meta.default.w,
          h: meta.default.h,
          minW: meta.default.minW,
          minH: meta.default.minH,
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
    if (!projectId) {
      return;
    }
    dismissFirstTimeStorage(projectId);
    setFirstTimeDismissed(true);
  }, [projectId]);

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

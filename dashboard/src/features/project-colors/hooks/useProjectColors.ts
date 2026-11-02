import { useCallback, useMemo } from 'react';
import { getProjectColor } from '@/features/project-colors/lib/palette';
import { useSSRLocalStorage } from '@/hooks/useSSRLocalStorage';

/**
 * Project colors are a personal setting: each person picks their own, and
 * one color belongs to one project only, across every organization.
 *
 * For now they are saved in this browser (localStorage), so they don't follow
 * the person to another browser or computer. Saving them to the account
 * needs a place on the server, to be agreed with the developers.
 */
export const PROJECT_COLORS_STORAGE_KEY = 'nhost-project-colors';

export interface ProjectColorsState {
  enabled: boolean;
  /** Project id to color id. */
  colors: Record<string, string>;
}

const DEFAULT_STATE: ProjectColorsState = { enabled: false, colors: {} };

export default function useProjectColors() {
  const [state, setState] = useSSRLocalStorage<ProjectColorsState>(
    PROJECT_COLORS_STORAGE_KEY,
    DEFAULT_STATE,
  );
  const enabled = state?.enabled ?? false;
  const colors = useMemo(() => state?.colors ?? {}, [state]);

  const getColorFor = useCallback(
    (projectId?: string | null) =>
      projectId ? getProjectColor(colors[projectId]) : undefined,
    [colors],
  );

  /** The project currently using a color, if any. */
  const getOwnerOf = useCallback(
    (colorId: string) =>
      Object.keys(colors).find((projectId) => colors[projectId] === colorId),
    [colors],
  );

  const setEnabled = useCallback(
    (nextEnabled: boolean) => setState({ enabled: nextEnabled, colors }),
    [colors, setState],
  );

  /**
   * Gives a project a color. If another project already has it, the two
   * swap: the other project takes this project's current color, or ends up
   * with none when this project had none.
   */
  const assignColor = useCallback(
    (projectId: string, colorId: string) => {
      const nextColors = { ...colors };
      const owner = Object.keys(colors).find(
        (id) => colors[id] === colorId && id !== projectId,
      );
      const previousColor = colors[projectId];

      if (owner) {
        if (previousColor) {
          nextColors[owner] = previousColor;
        } else {
          delete nextColors[owner];
        }
      }

      nextColors[projectId] = colorId;
      setState({ enabled, colors: nextColors });
    },
    [colors, enabled, setState],
  );

  const removeColor = useCallback(
    (projectId: string) => {
      if (!colors[projectId]) {
        return;
      }

      const nextColors = { ...colors };
      delete nextColors[projectId];
      setState({ enabled, colors: nextColors });
    },
    [colors, enabled, setState],
  );

  /**
   * Frees the colors of projects the person can no longer see (deleted, or
   * they lost access), so those colors can be used again.
   */
  const keepOnly = useCallback(
    (projectIds: string[]) => {
      const visible = new Set(projectIds);
      const stale = Object.keys(colors).filter((id) => !visible.has(id));

      if (stale.length === 0) {
        return;
      }

      const nextColors = { ...colors };
      stale.forEach((id) => {
        delete nextColors[id];
      });
      setState({ enabled, colors: nextColors });
    },
    [colors, enabled, setState],
  );

  return {
    enabled,
    colors,
    getColorFor,
    getOwnerOf,
    setEnabled,
    assignColor,
    removeColor,
    keepOnly,
  };
}

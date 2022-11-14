import type { ReactNode } from 'react';
import { useReducer } from 'react';

export interface UseTooltipReturnType {
  /**
   * Determines whether the tooltip is open.
   */
  open: boolean;
  /**
   * Tooltip title.
   */
  title: ReactNode;
  /**
   * Opens the tooltip with the given title.
   *
   * @param title - Title to display in the tooltip. This can be any valid JSX
   * element.
   */
  openTooltip: (title: ReactNode) => void;
  /**
   * Closes the tooltip, but leaves the title intact. This is useful for hiding
   * the tooltip without having a weird flash during the exit transition.
   */
  closeTooltip: () => void;
  /**
   * Resets the title to an empty string.
   */
  resetTooltipTitle: () => void;
}

interface TooltipState {
  open: boolean;
  title: ReactNode;
}

type TooltipAction =
  | { type: 'OPEN'; payload: ReactNode }
  | { type: 'CLOSE' }
  | { type: 'RESET_TITLE' };

function tooltipReducer(state: TooltipState, action: TooltipAction) {
  switch (action.type) {
    case 'OPEN':
      return { ...state, open: true, title: action.payload };
    case 'CLOSE':
      return { ...state, open: false };
    case 'RESET_TITLE':
      return { ...state, title: '' };
    default:
      return { ...state };
  }
}

/**
 * Use this hook to control the state of the tooltip.
 */
export default function useTooltip(): UseTooltipReturnType {
  const [{ open, title }, dispatch] = useReducer(tooltipReducer, {
    open: false,
    title: '',
  });

  function openTooltip(tooltipTitle: ReactNode) {
    dispatch({ type: 'OPEN', payload: tooltipTitle });
  }

  function closeTooltip() {
    dispatch({ type: 'CLOSE' });
  }

  function resetTooltipTitle() {
    dispatch({ type: 'RESET_TITLE' });
  }

  return {
    open,
    title,
    openTooltip,
    closeTooltip,
    resetTooltipTitle,
  };
}

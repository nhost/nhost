import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

export type CustomCheckEditorMode = 'builder' | 'json';

interface CustomCheckModeContextValue {
  mode: CustomCheckEditorMode;
  setMode: (mode: CustomCheckEditorMode) => void;
}

const CustomCheckModeContext =
  createContext<CustomCheckModeContextValue | null>(null);

export interface CustomCheckModeProviderProps {
  children: ReactNode;
  defaultMode?: CustomCheckEditorMode;
  mode?: CustomCheckEditorMode;
  onModeChange?: (mode: CustomCheckEditorMode) => void;
}

export function CustomCheckModeProvider({
  children,
  defaultMode = 'builder',
  mode: controlledMode,
  onModeChange,
}: CustomCheckModeProviderProps) {
  const [uncontrolledMode, setUncontrolledMode] =
    useState<CustomCheckEditorMode>(defaultMode);
  const mode = controlledMode ?? uncontrolledMode;
  const setMode = useCallback(
    (nextMode: CustomCheckEditorMode) => {
      if (controlledMode === undefined) {
        setUncontrolledMode(nextMode);
      }
      onModeChange?.(nextMode);
    },
    [controlledMode, onModeChange],
  );
  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);
  return (
    <CustomCheckModeContext.Provider value={value}>
      {children}
    </CustomCheckModeContext.Provider>
  );
}

export function useCustomCheckMode(): CustomCheckModeContextValue {
  const ctx = useContext(CustomCheckModeContext);
  if (!ctx) {
    throw new Error(
      'useCustomCheckMode must be used within a CustomCheckModeProvider',
    );
  }
  return ctx;
}

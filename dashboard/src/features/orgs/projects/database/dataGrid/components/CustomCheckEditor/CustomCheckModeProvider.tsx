import {
  createContext,
  type ReactNode,
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
}

export function CustomCheckModeProvider({
  children,
  defaultMode = 'builder',
}: CustomCheckModeProviderProps) {
  const [mode, setMode] = useState<CustomCheckEditorMode>(defaultMode);
  const value = useMemo(() => ({ mode, setMode }), [mode]);
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

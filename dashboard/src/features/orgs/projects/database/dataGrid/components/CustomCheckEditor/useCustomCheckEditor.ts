import { createContext, useContext } from 'react';

export const CustomCheckEditorContext = createContext<{
  schema: string;
  table: string;
  disabled: boolean;
}>({
  schema: '',
  table: '',
  disabled: false,
});

export default function useCustomCheckEditor() {
  const context = useContext(CustomCheckEditorContext);

  return context;
}

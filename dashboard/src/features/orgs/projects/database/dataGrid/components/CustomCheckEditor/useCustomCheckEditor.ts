import { createContext, useContext } from 'react';

export const CustomCheckEditorContext = createContext<{
  schema: string;
  table: string;
}>({
  schema: '',
  table: '',
});

export default function useCustomCheckEditor() {
  const context = useContext(CustomCheckEditorContext);

  return context;
}

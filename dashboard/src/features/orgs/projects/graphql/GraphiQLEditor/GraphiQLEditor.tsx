import { GraphiQLInterface } from 'graphiql';
import debounce from 'lodash.debounce';
import { useEffect, useMemo } from 'react';

interface GraphiQLEditorProps {
  onEditHeaders: (headers: string) => void;
}

export default function GraphiQLEditor({ onEditHeaders }: GraphiQLEditorProps) {
  const handleUserHeaderChange = useMemo(
    () => debounce(onEditHeaders, 200),
    [onEditHeaders],
  );

  useEffect(() => {
    return () => handleUserHeaderChange.cancel();
  }, [handleUserHeaderChange]);

  return (
    <GraphiQLInterface
      defaultEditorToolsVisibility="variables"
      onEditHeaders={handleUserHeaderChange}
    />
  );
}

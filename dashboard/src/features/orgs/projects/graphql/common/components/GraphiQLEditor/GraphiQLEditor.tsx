import { useEditorContext } from '@graphiql/react';
import { GraphiQLInterface } from 'graphiql';
import debounce from 'lodash.debounce';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { hasEditorTabContent } from '@/features/orgs/projects/graphql/common/utils/hasEditorTabContent';

interface GraphiQLEditorProps {
  /**
   * Function to be called when the user changes the headers.
   */
  onHeaderChange: (headers: Record<string, unknown>) => void;
}

export default function GraphiQLEditor({
  onHeaderChange,
}: GraphiQLEditorProps) {
  const { initialHeaders, initialVariables } = useEditorContext({
    nonNull: true,
  });
  const [variablesHaveContent, setVariablesHaveContent] = useState(() =>
    hasEditorTabContent(initialVariables),
  );
  const [headersHaveContent, setHeadersHaveContent] = useState(() =>
    hasEditorTabContent(initialHeaders),
  );

  const handleUserHeaderChange = useMemo(
    () =>
      debounce((headers: string) => {
        setHeadersHaveContent(hasEditorTabContent(headers));

        if (!headers.trim()) {
          onHeaderChange({});

          return;
        }

        try {
          const parsedHeaders: Record<string, unknown> = JSON.parse(headers);

          onHeaderChange(parsedHeaders);
        } catch {
          // We are not going to do anything if the headers are not valid JSON.
        }
      }, 200),
    [onHeaderChange],
  );

  useEffect(() => {
    const editorTools = document.querySelector('.graphiql-editor-tools');
    const variablesButton = editorTools?.querySelector(
      'button[data-name="variables"]',
    );
    const headersButton = editorTools?.querySelector(
      'button[data-name="headers"]',
    );

    if (variablesHaveContent) {
      variablesButton?.setAttribute('data-has-content', 'true');
    } else {
      variablesButton?.removeAttribute('data-has-content');
    }

    if (headersHaveContent) {
      headersButton?.setAttribute('data-has-content', 'true');
    } else {
      headersButton?.removeAttribute('data-has-content');
    }
  }, [headersHaveContent, variablesHaveContent]);

  useEffect(
    () => () => handleUserHeaderChange.cancel(),
    [handleUserHeaderChange],
  );

  const handleVariablesChange = useCallback((variables: string) => {
    setVariablesHaveContent(hasEditorTabContent(variables));
  }, []);

  return (
    <GraphiQLInterface
      defaultEditorToolsVisibility="variables"
      onEditHeaders={handleUserHeaderChange}
      onEditVariables={handleVariablesChange}
    />
  );
}

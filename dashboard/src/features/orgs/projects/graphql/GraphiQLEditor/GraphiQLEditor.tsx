import { useEditorContext } from '@graphiql/react';
import { GraphiQLInterface } from 'graphiql';
import debounce from 'lodash.debounce';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';

interface GraphiQLEditorProps {
  headerText: string;
  onEditHeaders: (headers: string) => void;
}

interface PendingHeaderChange {
  canceled: boolean;
}

export function useGraphiQLHeaderSync({
  headerText,
  onEditHeaders,
}: GraphiQLEditorProps) {
  const { activeTabIndex, headerEditor, tabs, updateActiveTabValues } =
    useEditorContext({ nonNull: true });
  const activeTabId = tabs[activeTabIndex]?.id;
  const currentHeaderText = useRef(headerText);
  const pendingHeaderChanges = useRef<PendingHeaderChange[]>([]);
  const synchronizedEditor = useRef(headerEditor);
  const synchronizedTabId = useRef<string | undefined>(undefined);
  const handleUserHeaderChange = useMemo(
    () => debounce(onEditHeaders, 200),
    [onEditHeaders],
  );
  const handleEditorHeaderChange = useCallback(
    (nextHeaderText: string) => {
      const pendingChange: PendingHeaderChange = { canceled: false };
      pendingHeaderChanges.current.push(pendingChange);

      // GraphiQL emits this before its active tab context updates. Deferring the
      // callback lets the layout effect discard only tab-driven editor resets.
      queueMicrotask(() => {
        pendingHeaderChanges.current = pendingHeaderChanges.current.filter(
          (change) => change !== pendingChange,
        );

        if (pendingChange.canceled) {
          return;
        }

        currentHeaderText.current = nextHeaderText;
        handleUserHeaderChange(nextHeaderText);
      });
    },
    [handleUserHeaderChange],
  );

  useLayoutEffect(() => {
    currentHeaderText.current = headerText;
  }, [headerText]);

  useLayoutEffect(() => {
    if (!headerEditor || !activeTabId) {
      return;
    }

    const editorChanged = synchronizedEditor.current !== headerEditor;
    const tabChanged =
      synchronizedTabId.current !== undefined &&
      synchronizedTabId.current !== activeTabId;

    if (!editorChanged && !tabChanged) {
      return;
    }

    synchronizedEditor.current = headerEditor;
    synchronizedTabId.current = activeTabId;

    if (tabChanged) {
      const tabDrivenChange = pendingHeaderChanges.current.at(-1);

      if (tabDrivenChange) {
        tabDrivenChange.canceled = true;
      }
    }

    const restoredHeaderText = currentHeaderText.current;

    if (headerEditor.getValue() !== restoredHeaderText) {
      headerEditor.setValue(restoredHeaderText);
    }

    updateActiveTabValues({ headers: restoredHeaderText });
  }, [activeTabId, headerEditor, updateActiveTabValues]);

  useEffect(() => {
    return () => {
      for (const pendingChange of pendingHeaderChanges.current) {
        pendingChange.canceled = true;
      }
      handleUserHeaderChange.cancel();
    };
  }, [handleUserHeaderChange]);

  return handleEditorHeaderChange;
}

export default function GraphiQLEditor(props: GraphiQLEditorProps) {
  const handleEditorHeaderChange = useGraphiQLHeaderSync(props);

  return (
    <GraphiQLInterface
      defaultEditorToolsVisibility="variables"
      onEditHeaders={handleEditorHeaderChange}
    />
  );
}

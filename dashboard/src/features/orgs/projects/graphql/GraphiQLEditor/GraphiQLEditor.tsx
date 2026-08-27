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
  headerClearVersion: number;
  headerText: string;
  onEditHeaders: (headers: string) => void;
}

interface PendingHeaderChange {
  canceled: boolean;
}

export function useGraphiQLHeaderSync({
  headerClearVersion,
  headerText,
  onEditHeaders,
}: GraphiQLEditorProps) {
  const { activeTabIndex, headerEditor, tabs, updateActiveTabValues } =
    useEditorContext({ nonNull: true });
  const activeTabId = tabs[activeTabIndex]?.id;
  const currentHeaderText = useRef(headerText);
  const onEditHeadersRef = useRef(onEditHeaders);
  const pendingHeaderChanges = useRef<PendingHeaderChange[]>([]);
  const synchronizedClearVersion = useRef(headerClearVersion);
  const synchronizedEditor = useRef(headerEditor);
  const synchronizedTabId = useRef<string | undefined>(undefined);
  const handleUserHeaderChange = useMemo(
    () =>
      debounce((nextHeaderText: string) => {
        onEditHeadersRef.current(nextHeaderText);
      }, 200),
    [],
  );
  const cancelPendingHeaderChanges = useCallback(() => {
    for (const pendingChange of pendingHeaderChanges.current) {
      pendingChange.canceled = true;
    }
    pendingHeaderChanges.current = [];
    handleUserHeaderChange.cancel();
  }, [handleUserHeaderChange]);
  const handleEditorHeaderChange = useCallback(
    (nextHeaderText: string) => {
      const pendingChange: PendingHeaderChange = { canceled: false };
      pendingHeaderChanges.current.push(pendingChange);

      // GraphiQL emits a tab-driven change before updating its active tab.
      // Deferring changes lets the layout effect queue its restored value last,
      // so the restore wins both the current value and the debounce.
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
    onEditHeadersRef.current = onEditHeaders;
  }, [onEditHeaders]);

  useLayoutEffect(() => {
    currentHeaderText.current = headerText;
  }, [headerText]);

  useLayoutEffect(() => {
    if (synchronizedClearVersion.current === headerClearVersion) {
      return;
    }

    synchronizedClearVersion.current = headerClearVersion;
    currentHeaderText.current = '';
    cancelPendingHeaderChanges();

    if (headerEditor && headerEditor.getValue() !== '') {
      headerEditor.setValue('');
      cancelPendingHeaderChanges();
    }

    if (activeTabId) {
      updateActiveTabValues({ headers: '' });
    }
  }, [
    activeTabId,
    cancelPendingHeaderChanges,
    headerClearVersion,
    headerEditor,
    updateActiveTabValues,
  ]);

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

    const restoredHeaderText = currentHeaderText.current;

    if (headerEditor.getValue() !== restoredHeaderText) {
      headerEditor.setValue(restoredHeaderText);
    }

    updateActiveTabValues({ headers: restoredHeaderText });
  }, [activeTabId, headerEditor, updateActiveTabValues]);

  useEffect(() => cancelPendingHeaderChanges, [cancelPendingHeaderChanges]);

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

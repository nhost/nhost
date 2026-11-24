import {
  KEY_MAP,
  pick,
  useGraphiQL,
  useGraphiQLPluginContext,
} from '@graphiql/react';
import { useEffect } from 'react';

/**
 * Calls `onRun` when a run starts, whatever started it. GraphiQL has no run
 * event: its transport hook covers every request sent, and the run shortcut in
 * the query, variables and headers editors covers a run GraphiQL refuses to
 * send (invalid Variables or Headers JSON), which never reaches the transport.
 * Our Run button reports its own presses. Call it inside `GraphiQLProvider`
 * with a stable callback.
 */
export default function useOnRun(onRun: VoidFunction) {
  const { transport } = useGraphiQLPluginContext();
  const { introspectionQueryName, queryEditor, variableEditor, headerEditor } =
    useGraphiQL(
      pick(
        'introspectionQueryName',
        'queryEditor',
        'variableEditor',
        'headerEditor',
      ),
    );

  // Schema fetches go through the transport too.
  useEffect(
    () =>
      transport?.onBeforeSend((request) => {
        if (request.operationName !== introspectionQueryName) {
          onRun();
        }

        return request;
      }),
    [introspectionQueryName, onRun, transport],
  );

  // GraphiQL's own binding, matched by Monaco, so it follows the OS and any
  // change GraphiQL makes to it.
  useEffect(() => {
    const listeners = [queryEditor, variableEditor, headerEditor].map(
      (editor) =>
        editor?.onKeyDown((event) => {
          if (
            KEY_MAP.runQuery.keybindings.some((keybinding) =>
              event.equals(keybinding),
            )
          ) {
            onRun();
          }
        }),
    );

    return () => {
      for (const listener of listeners) {
        listener?.dispose();
      }
    };
  }, [headerEditor, onRun, queryEditor, variableEditor]);
}

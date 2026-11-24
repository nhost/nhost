import { pick, useGraphiQL, useMonaco } from '@graphiql/react';
import { type RefObject, useEffect } from 'react';

/**
 * GraphiQL creates its editors with Fira Code. Gives them the monospace font
 * the rest of GraphiQL uses: `--font-family-mono` on the GraphiQL container,
 * which globals.css sets to the dashboard's. Call it inside
 * `GraphiQLProvider`.
 */
export default function useEditorFont(
  containerRef: RefObject<HTMLElement | null>,
) {
  const monaco = useMonaco((state) => state.monaco);
  const { queryEditor, variableEditor, headerEditor, responseEditor } =
    useGraphiQL(
      pick('queryEditor', 'variableEditor', 'headerEditor', 'responseEditor'),
    );

  useEffect(() => {
    const container = containerRef.current;
    const fontFamily = container
      ? getComputedStyle(container)
          .getPropertyValue('--font-family-mono')
          .trim()
      : '';

    if (!fontFamily) {
      return undefined;
    }

    for (const editor of [
      queryEditor,
      variableEditor,
      headerEditor,
      responseEditor,
    ]) {
      editor?.updateOptions({ fontFamily });
    }

    // Monaco measures a font once. Measured before the font has loaded, it
    // keeps the fallback's widths, and the cursor and selections drift.
    let isCurrent = true;
    document.fonts.load(`1em ${fontFamily}`).then(() => {
      if (isCurrent) {
        monaco?.editor.remeasureFonts();
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [
    containerRef,
    headerEditor,
    monaco,
    queryEditor,
    responseEditor,
    variableEditor,
  ]);
}

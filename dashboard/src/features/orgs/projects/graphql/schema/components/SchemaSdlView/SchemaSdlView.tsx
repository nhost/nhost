import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode';
import CodeMirror, {
  Decoration,
  type DecorationSet,
  EditorView,
  type ReactCodeMirrorRef,
  StateEffect,
  StateField,
} from '@uiw/react-codemirror';
import { graphql } from 'cm6-graphql';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import type { SchemaSearchHandle } from '@/features/orgs/projects/graphql/common/components/GraphQLSchemaBrowser';
import useSearchMatches from '@/features/orgs/projects/graphql/common/components/GraphQLSchemaBrowser/useSearchMatches';
import {
  codeMirrorAppBackground,
  codeMirrorConsoleBackground,
} from '@/lib/codeMirrorAppTheme';
import { useThemePreference } from '@/providers/Theme';

export interface SchemaSdlViewProps {
  sdl: string;
}

interface TextMatch {
  from: number;
  to: number;
}

const matchMark = Decoration.mark({ class: 'cm-schema-search-match' });
const activeMatchMark = Decoration.mark({
  class: 'cm-schema-search-match cm-schema-search-match-active',
});

const setSearchMarks = StateEffect.define<{
  matches: TextMatch[];
  active: number;
}>();

const searchMarks = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(marks, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setSearchMarks)) {
        const { matches, active } = effect.value;

        return Decoration.set(
          matches.map(({ from, to }, index) =>
            (index === active ? activeMatchMark : matchMark).range(from, to),
          ),
        );
      }
    }

    return marks.map(transaction.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});

const searchMarksTheme = EditorView.baseTheme({
  '.cm-schema-search-match': {
    backgroundColor: 'rgb(250 204 21 / 0.25)',
    borderRadius: '2px',
  },
  '.cm-schema-search-match-active': {
    backgroundColor: 'rgb(249 115 22 / 0.6)',
    outline: '1px solid rgb(249 115 22)',
  },
});

const LIGHT_EXTENSIONS = [
  graphql(),
  searchMarks,
  searchMarksTheme,
  codeMirrorAppBackground,
];
const DARK_EXTENSIONS = [
  graphql(),
  searchMarks,
  searchMarksTheme,
  codeMirrorConsoleBackground,
  codeMirrorAppBackground,
];

function findTextMatches(text: string, term: string): TextMatch[] {
  const haystack = text.toLowerCase();
  const needle = term.toLowerCase();
  const matches: TextMatch[] = [];

  for (
    let from = haystack.indexOf(needle);
    from !== -1;
    from = haystack.indexOf(needle, from + needle.length)
  ) {
    matches.push({ from, to: from + needle.length });
  }

  return matches;
}

/**
 * Shows a GraphQL SDL document read-only, styled like the configuration
 * editor. Search is driven through the ref: it marks every match, marks the
 * active one more strongly and scrolls it into view, so it also finds text
 * CodeMirror has not rendered.
 */
const SchemaSdlView = forwardRef<SchemaSearchHandle, SchemaSdlViewProps>(
  ({ sdl }, ref) => {
    const { resolvedTheme } = useThemePreference();
    const isLight = resolvedTheme === 'light';
    const editorRef = useRef<ReactCodeMirrorRef>(null);

    const matches = useSearchMatches<TextMatch>((textMatches, active) =>
      editorRef.current?.view?.dispatch({
        effects: [
          setSearchMarks.of({ matches: textMatches, active }),
          ...(textMatches.length > 0
            ? [
                EditorView.scrollIntoView(textMatches[active].from, {
                  y: 'center',
                }),
              ]
            : []),
        ],
      }),
    );

    useImperativeHandle(ref, () => ({
      find: (term) => matches.start(findTextMatches(sdl, term)),
      next: matches.next,
      previous: matches.previous,
    }));

    return (
      <CodeMirror
        ref={editorRef}
        value={sdl}
        aria-label="Schema SDL"
        width="100%"
        minHeight="24rem"
        theme={isLight ? vscodeLight : vscodeDark}
        extensions={isLight ? LIGHT_EXTENSIONS : DARK_EXTENSIONS}
        editable={false}
        readOnly
        basicSetup={{
          highlightActiveLine: false,
          highlightActiveLineGutter: false,
          highlightSelectionMatches: false,
        }}
      />
    );
  },
);
SchemaSdlView.displayName = 'SchemaSdlView';

export default SchemaSdlView;

import { PostgreSQL, sql } from '@codemirror/lang-sql';
import { EditorView } from '@uiw/react-codemirror';

export const SQL_EDITOR_EXTENSIONS = [
  sql({ dialect: PostgreSQL }),
  EditorView.contentAttributes.of({
    'aria-label': 'SQL command',
    tabindex: '0',
  }),
];

// Editor popups intercept Escape after the dialog, so disable their shortcuts.
export const SQL_EDITOR_SETUP = {
  foldGutter: false,
  autocompletion: false,
  completionKeymap: false,
  searchKeymap: false,
};

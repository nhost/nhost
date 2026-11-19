import { PostgreSQL, sql as sqlLanguage } from '@codemirror/lang-sql';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import CodeMirror, { EditorView } from '@uiw/react-codemirror';
import { Label } from '@/components/ui/v3/label';
import { codeMirrorAppBackground } from '@/lib/codeMirrorAppTheme';
import { cn } from '@/lib/utils';
import { useThemePreference } from '@/providers/Theme';

// Stable references so CodeMirror doesn't reconfigure on every keystroke.
const SQL_EXTENSIONS = [
  sqlLanguage({ dialect: PostgreSQL }),
  codeMirrorAppBackground,
];

const EDITABLE_SQL_EXTENSIONS = [
  ...SQL_EXTENSIONS,
  EditorView.contentAttributes.of({ tabindex: '0', 'aria-label': 'SQL' }),
];

// The dialog handles Escape before the editor does, so pressing it to close
// a completion or search popup would close the dialog and discard the edits.
const BASIC_SETUP = {
  autocompletion: false,
  completionKeymap: false,
  searchKeymap: false,
};

export interface ExtensionSQLEditorProps {
  value: string;
  onChange: (value: string) => void;
  editable: boolean;
  /**
   * Blocks selecting and interacting with the SQL, not only editing it.
   */
  disabled?: boolean;
  height?: string;
}

export default function ExtensionSQLEditor({
  value,
  onChange,
  editable,
  disabled = false,
  height = '140px',
}: ExtensionSQLEditorProps) {
  const { resolvedTheme } = useThemePreference();
  const isEditable = editable && !disabled;

  return (
    <div className="space-y-2">
      <Label>SQL</Label>
      <CodeMirror
        aria-label="SQL"
        value={value}
        height={height}
        aria-disabled={disabled || undefined}
        className={cn(
          'overflow-hidden rounded-md border',
          disabled && 'pointer-events-none select-none',
        )}
        theme={resolvedTheme === 'light' ? githubLight : githubDark}
        extensions={isEditable ? EDITABLE_SQL_EXTENSIONS : SQL_EXTENSIONS}
        editable={isEditable}
        indentWithTab={false}
        basicSetup={BASIC_SETUP}
        onChange={onChange}
      />
    </div>
  );
}

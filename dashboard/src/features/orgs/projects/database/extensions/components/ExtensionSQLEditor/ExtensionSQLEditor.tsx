import { PostgreSQL, sql as sqlLanguage } from '@codemirror/lang-sql';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import CodeMirror from '@uiw/react-codemirror';
import { Label } from '@/components/ui/v3/label';
import { cn } from '@/lib/utils';
import { useThemePreference } from '@/providers/Theme';

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
        extensions={[sqlLanguage({ dialect: PostgreSQL })]}
        editable={editable && !disabled}
        onChange={onChange}
      />
    </div>
  );
}

import { useTheme } from '@mui/material';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import CodeMirror from '@uiw/react-codemirror';
import { graphql } from 'cm6-graphql';
import { cn } from '@/lib/utils';

export interface GraphQLSdlEditorProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  className?: string;
  'aria-label'?: string;
}

export default function GraphQLSdlEditor({
  value,
  onChange,
  readOnly = false,
  className,
  'aria-label': ariaLabel,
}: GraphQLSdlEditorProps) {
  const theme = useTheme();

  return (
    <CodeMirror
      value={value}
      aria-label={ariaLabel}
      className={cn('overflow-hidden rounded-md border text-sm', className)}
      theme={theme.palette.mode === 'light' ? githubLight : githubDark}
      extensions={[graphql()]}
      onChange={onChange}
      readOnly={readOnly}
      editable={!readOnly}
      basicSetup={{
        foldGutter: false,
        highlightActiveLine: !readOnly,
        highlightActiveLineGutter: !readOnly,
      }}
    />
  );
}

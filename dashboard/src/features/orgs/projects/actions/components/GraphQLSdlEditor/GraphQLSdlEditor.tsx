import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import CodeMirror from '@uiw/react-codemirror';
import { graphql } from 'cm6-graphql';
import { useColorPreference } from '@/components/ui/v2/useColorPreference';
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
  const { color } = useColorPreference();

  return (
    <CodeMirror
      value={value}
      aria-label={ariaLabel}
      className={cn('overflow-hidden rounded-md border text-sm', className)}
      theme={color === 'light' ? githubLight : githubDark}
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

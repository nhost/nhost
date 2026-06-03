import { PostgreSQL, sql } from '@codemirror/lang-sql';
import { useTheme } from '@mui/material';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import CodeMirror from '@uiw/react-codemirror';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/v3/button';

export interface FunctionDefinitionPreviewProps {
  functionLabel: string;
  definition: string;
  onEditInSqlEditor: () => void;
}

export default function FunctionDefinitionPreview({
  functionLabel,
  definition,
  onEditInSqlEditor,
}: FunctionDefinitionPreviewProps) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="overflow-hidden rounded-md border bg-muted/30">
      <div className="flex items-center justify-between gap-2 px-2 py-1.5">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-sm px-1 py-0.5 text-left text-sm hover:bg-accent/50"
          data-testid="function-definition-preview-toggle"
        >
          {expanded ? (
            <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className="font-medium">Function definition</span>
          <span className="truncate font-mono text-muted-foreground text-xs">
            {functionLabel}
          </span>
        </button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onEditInSqlEditor}
          className="h-7 shrink-0 gap-1.5 text-muted-foreground hover:text-foreground"
          data-testid="function-definition-preview-edit"
        >
          <span className="text-xs">Edit in SQL Editor</span>
          <ExternalLink className="size-3.5" />
        </Button>
      </div>
      {expanded && (
        <div
          className="max-h-[240px] overflow-auto border-t"
          data-testid="function-definition-preview-code"
        >
          <CodeMirror
            value={definition}
            theme={theme.palette.mode === 'light' ? githubLight : githubDark}
            extensions={[sql({ dialect: PostgreSQL })]}
            readOnly
            basicSetup={{
              lineNumbers: false,
              foldGutter: false,
              highlightActiveLine: false,
              highlightActiveLineGutter: false,
            }}
          />
        </div>
      )}
    </div>
  );
}

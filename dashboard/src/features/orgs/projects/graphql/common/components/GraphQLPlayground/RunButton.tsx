import {
  formatShortcutForOS,
  useGraphiQL,
  useGraphiQLActions,
  useOperationsEditorState,
} from '@graphiql/react';
import { PlayIcon } from 'lucide-react';
import { Button } from '@/components/ui/v3/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { cn } from '@/lib/utils';

interface RunButtonProps {
  className?: string;
  /** Called on each press, before the run starts. */
  onRun: VoidFunction;
}

/**
 * Runs the query; a run in progress is stopped first. Off while the editor
 * holds nothing to run: empty, or only comments (like GraphiQL's welcome
 * text).
 */
export default function RunButton({ className, onRun }: RunButtonProps) {
  const { run, stop } = useGraphiQLActions();
  const isFetching = useGraphiQL((state) => state.isFetching);
  const [query] = useOperationsEditorState();
  const hasQuery = query.replace(/#.*$/gm, '').trim() !== '';

  function executeQuery() {
    onRun();

    if (isFetching) {
      stop();
    }

    run();
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* A disabled button gets no hover, so the span carries the tooltip. */}
        <span className={cn('inline-flex', className)}>
          <Button
            size="xs"
            onClick={executeQuery}
            disabled={!hasQuery}
            aria-label="Execute GraphQL query"
            className="gap-1.5 px-2.5"
          >
            <PlayIcon className="h-3.5 w-3.5" />
            Run
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        {hasQuery
          ? `Run (${formatShortcutForOS('Ctrl+Enter')})`
          : 'Write a query to run it'}
      </TooltipContent>
    </Tooltip>
  );
}

import { Eye } from 'lucide-react';
import { CodeBlock } from '@/components/presentational/CodeBlock';
import { Button } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/v3/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import type { InconsistentObjectDefinition } from '@/utils/hasura-api/generated/schemas';

interface InconsistentObjectDefinitionDialogProps {
  name: string;
  definition: InconsistentObjectDefinition;
}

export default function InconsistentObjectDefinitionDialog({
  name,
  definition,
}: InconsistentObjectDefinitionDialogProps) {
  return (
    <Dialog>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Eye className="h-4 w-4" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>View definition</TooltipContent>
      </Tooltip>
      <DialogContent className="max-h-[80vh] max-w-xl overflow-y-auto text-foreground">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            Inconsistent Object Definition
          </DialogTitle>
        </DialogHeader>
        <div className="min-w-0">
          <p className="break-all font-mono text-muted-foreground text-sm">
            {name}
          </p>
        </div>
        <CodeBlock
          className="rounded py-2"
          copyToClipboardToastTitle="Object definition"
        >
          {JSON.stringify(definition, null, 2)}
        </CodeBlock>
      </DialogContent>
    </Dialog>
  );
}

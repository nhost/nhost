import { Eye } from 'lucide-react';
import { CodeBlock } from '@/components/presentational/CodeBlock';
import { Button } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/v3/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';

interface InconsistentObjectDefinitionDialogProps {
  definition: unknown;
}

export default function InconsistentObjectDefinitionDialog({
  definition,
}: InconsistentObjectDefinitionDialogProps) {
  return (
    <Dialog>
      <TooltipProvider>
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
      </TooltipProvider>
      <DialogContent className="sm:max-w-lg" hideCloseButton>
        <DialogHeader>
          <DialogTitle className="text-foreground">
            Object Definition
          </DialogTitle>
        </DialogHeader>
        <CodeBlock
          className="rounded py-2"
          copyToClipboardToastTitle="Object definition"
        >
          {JSON.stringify(definition, null, 2)}
        </CodeBlock>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" className="!text-sm+ text-foreground">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

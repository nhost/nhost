import { CopyIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/v3/alert';
import { Button } from '@/components/ui/v3/button';
import { copy } from '@/utils/copy';

interface CreatedPATAlertProps {
  personalAccessToken: string;
}

export default function CreatedPATAlert({
  personalAccessToken,
}: CreatedPATAlertProps) {
  return (
    <Alert variant="info" className="grid grid-flow-row gap-2">
      <AlertDescription className="col-start-1">
        <p className="text-sm">
          This token will not be shown again. Make sure to copy it now.
        </p>
      </AlertDescription>

      <div className="flex items-center justify-center gap-2 bg-transparent">
        <code className="break-all rounded bg-primary-light px-1.5 py-0.5 font-display font-semibold text-foreground text-xs">
          {personalAccessToken}
        </code>

        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label="Copy Personal Access Token"
          onClick={() => copy(personalAccessToken, 'Personal access token')}
        >
          <CopyIcon className="h-4 w-4" />
        </Button>
      </div>
    </Alert>
  );
}

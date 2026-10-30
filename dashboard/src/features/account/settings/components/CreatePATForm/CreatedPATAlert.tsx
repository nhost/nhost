import { CopyToClipboardButton } from '@/components/presentational/CopyToClipboardButton';
import { Alert, AlertDescription } from '@/components/ui/v3/alert';

interface CreatedPATAlertProps {
  personalAccessToken: string;
}

export default function CreatedPATAlert({
  personalAccessToken,
}: CreatedPATAlertProps) {
  return (
    <Alert className="grid grid-flow-row gap-2">
      <AlertDescription className="col-start-1">
        <p className="text-sm">
          This token will not be shown again. Make sure to copy it now.
        </p>
      </AlertDescription>

      <div className="flex items-center justify-center gap-2 bg-transparent">
        <code className="break-all rounded bg-primary-light px-1.5 py-0.5 font-display font-semibold text-foreground text-xs dark:bg-[#2f363d]">
          {personalAccessToken}
        </code>

        <CopyToClipboardButton
          textToCopy={personalAccessToken}
          title="Personal access token"
        />
      </div>
    </Alert>
  );
}

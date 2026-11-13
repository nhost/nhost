import { CopyToClipboardButton } from '@/components/presentational/CopyToClipboardButton';
import { Alert } from '@/components/ui/v3/alert';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/v3/input-group';

interface CreatedPATAlertProps {
  personalAccessToken: string;
}

/**
 * The new token in a read-only field with its copy button, like the
 * connection fields elsewhere, and the usual warning box saying it won't
 * show again.
 */
export default function CreatedPATAlert({
  personalAccessToken,
}: CreatedPATAlertProps) {
  return (
    <div className="grid gap-3">
      <InputGroup>
        <InputGroupInput
          readOnly
          aria-label="Personal access token"
          value={personalAccessToken}
          className="truncate font-mono text-sm"
          onFocus={(event) => event.currentTarget.select()}
        />
        <InputGroupAddon align="inline-end">
          <CopyToClipboardButton
            textToCopy={personalAccessToken}
            title="Personal access token"
          />
        </InputGroupAddon>
      </InputGroup>

      <Alert variant="warning">
        This token will not be shown again. Make sure to copy it now.
      </Alert>
    </div>
  );
}

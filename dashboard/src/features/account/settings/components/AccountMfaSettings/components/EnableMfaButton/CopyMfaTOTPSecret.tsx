import { CopyToClipboardButton } from '@/components/presentational/CopyToClipboardButton';

interface Props {
  totpSecret: string | null;
}

function CopyMfaTOTPSecret({ totpSecret }: Props) {
  return (
    <CopyToClipboardButton
      className="p-2"
      textToCopy={totpSecret}
      title="TOTP secret"
    >
      OR Copy TOTP secret
    </CopyToClipboardButton>
  );
}

export default CopyMfaTOTPSecret;

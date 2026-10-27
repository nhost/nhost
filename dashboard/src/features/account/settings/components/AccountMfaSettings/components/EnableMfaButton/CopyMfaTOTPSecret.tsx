import { CopyToClipboardButton } from '@/components/presentational/CopyToClipboardButton';

interface Props {
  totpSecret: string | null;
}

function CopyMfaTOTPSecret({ totpSecret }: Props) {
  return (
    <CopyToClipboardButton textToCopy={totpSecret} title="TOTP secret">
      Copy TOTP secret
    </CopyToClipboardButton>
  );
}

export default CopyMfaTOTPSecret;

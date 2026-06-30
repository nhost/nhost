import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { MfaOtpForm } from '@/components/common/MfaOtpForm';
import { Spinner } from '@/components/ui/v3/spinner';
import useActionWithElevatedPermissions from '@/features/account/settings/hooks/useActionWithElevatedPermissions';
import { useNhostClient } from '@/providers/nhost';
import { getToastStyleProps } from '@/utils/constants/settings';
import CopyMfaTOTPSecret from './CopyMfaTOTPSecret';

interface Props {
  onSuccess: () => void;
}

function MfaQRCodeAndTOTPSecret({ onSuccess }: Props) {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | undefined>();
  const [totpSecret, setTotpSecret] = useState<string | undefined>();
  const [isGenerating, setIsGenerating] = useState(true);
  const [isActivating, setIsActivating] = useState(false);
  const nhost = useNhostClient();

  const generateMfa = useActionWithElevatedPermissions({
    actionFn: nhost.auth.changeUserMfa,
    onSuccess: (response) => {
      setQrCodeDataUrl(response.body.imageUrl);
      setTotpSecret(response.body.totpSecret);
    },
    successMessage: 'A new TOTP secret has been generated.',
  });

  async function onSendMfaOtp(code: string) {
    try {
      setIsActivating(true);
      await nhost.auth.verifyChangeUserMfa({
        code,
        activeMfaType: 'totp',
      });
      toast.success(
        'Multi-factor authentication has been enabled.',
        getToastStyleProps(),
      );
      onSuccess();
    } finally {
      setIsActivating(false);
    }
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: generate once on mount
  useEffect(() => {
    generateMfa().finally(() => setIsGenerating(false));
  }, []);

  return (
    <div className="flex w-full flex-col items-center justify-center gap-4">
      {isGenerating && <Spinner />}
      {qrCodeDataUrl && (
        <>
          <div className="flex flex-col justify-center gap-4">
            <p className="text-base">
              Scan the QR Code with your authenticator app
            </p>
            {/** biome-ignore lint/performance/noImgElement: used for qrcode */}
            <img alt="qrcode" src={qrCodeDataUrl} className="mx-auto w-64" />
          </div>
          {totpSecret && <CopyMfaTOTPSecret totpSecret={totpSecret} />}
          <MfaOtpForm loading={isActivating} sendMfaOtp={onSendMfaOtp} />
        </>
      )}
    </div>
  );
}

export default MfaQRCodeAndTOTPSecret;

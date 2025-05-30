/* eslint-disable @next/next/no-img-element */
import { MfaOtpForm } from '@/components/common/MfaOtpForm';
import { Spinner } from '@/components/ui/v3/spinner';
import useActionWithElevatedPermissions from '@/features/account/settings/hooks/useActionWithElevatedPermissions';
import { useConfigMfa } from '@nhost/nextjs';
import { useEffect } from 'react';
import { toast } from 'react-hot-toast';
import CopyMfaTOTPSecret from './CopyMfaTOTPSecret';

interface Props {
  onSuccess: () => void;
}

const successMessage = 'Multi-factor authentication has been enabled.';

function MfaQRCodeAndTOTPSecret({ onSuccess }: Props) {
  const {
    generateQrCode,
    qrCodeDataUrl,
    isGenerated,
    isGenerating,
    activateMfa: actionFn,
    isActivating,
    totpSecret,
  } = useConfigMfa();
  const activateMfa = useActionWithElevatedPermissions({
    actionFn,
    onSuccess,
    successMessage,
  });

  useEffect(() => {
    async function generate() {
      const result = await generateQrCode();
      if (result.error) {
        toast.error(result.error.message);
      }
    }
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex w-full flex-col items-center justify-center gap-4">
      {isGenerating && <Spinner />}
      {isGenerated && qrCodeDataUrl && (
        <>
          <div className="flex flex-col justify-center gap-4">
            <p className="text-base">
              Scan the QR Code with your authenticator app
            </p>
            <img alt="qrcode" src={qrCodeDataUrl} className="mx-auto w-64" />
          </div>
          <CopyMfaTOTPSecret totpSecret={totpSecret} />
          <MfaOtpForm loading={isActivating} sendMfaOtp={activateMfa} />
        </>
      )}
    </div>
  );
}

export default MfaQRCodeAndTOTPSecret;

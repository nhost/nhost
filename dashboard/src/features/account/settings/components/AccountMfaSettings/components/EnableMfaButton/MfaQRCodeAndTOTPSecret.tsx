/* eslint-disable @next/next/no-img-element */
import { MfaOtpForm } from '@/components/common/MfaOtpForm';
import { Spinner } from '@/components/ui/v3/spinner';
import { getToastStyleProps } from '@/utils/constants/settings';
import { useConfigMfa } from '@nhost/nextjs';
import { useEffect } from 'react';
import { toast } from 'react-hot-toast';
import CopyMfaTOTPSecret from './CopyMfaTOTPSecret';

const defaultErrorMessage =
  'An error occurred while trying to enable multi-factor authentication. Please try again.';

interface Props {
  onSuccess: () => void;
}

function MfaQRCodeAndTOTPSecret({ onSuccess }: Props) {
  const {
    generateQrCode,
    qrCodeDataUrl,
    isGenerated,
    isGenerating,
    activateMfa,
    isActivating,
    totpSecret,
  } = useConfigMfa();

  async function onSendMfaOtp(code: string) {
    const result = await activateMfa(code);
    if (result.error) {
      toast.error(
        result.error.message || defaultErrorMessage,
        getToastStyleProps(),
      );
      return false;
    }
    toast.success(
      'Multi-factor authentication has been enabled.',
      getToastStyleProps(),
    );
    onSuccess();
    return true;
  }
  useEffect(() => {
    async function generate() {
      const result = await generateQrCode();
      if (result.error) {
        toast.error(result.error.message, getToastStyleProps());
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
          <MfaOtpForm loading={isActivating} sendMfaOtp={onSendMfaOtp} />
        </>
      )}
    </div>
  );
}

export default MfaQRCodeAndTOTPSecret;

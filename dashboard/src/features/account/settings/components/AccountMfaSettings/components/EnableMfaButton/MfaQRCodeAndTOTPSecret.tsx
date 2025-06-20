/* eslint-disable @next/next/no-img-element */
import { MfaOtpForm } from '@/components/common/MfaOtpForm';
import { Spinner } from '@/components/ui/v3/spinner';
import { useNhostClient } from '@/providers/nhost';
import { getToastStyleProps } from '@/utils/constants/settings';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import CopyMfaTOTPSecret from './CopyMfaTOTPSecret';

interface Props {
  onSuccess: () => void;
}

function MfaQRCodeAndTOTPSecret({ onSuccess }: Props) {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | undefined>();
  const [totpSecret, setTotpSecret] = useState<string | undefined>();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const nhost = useNhostClient();

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
      return true;
    } finally {
      setIsActivating(false);
    }
  }

  useEffect(() => {
    async function generate() {
      try {
        setIsGenerating(true);
        const response = await nhost.auth.changeUserMfa();
        setQrCodeDataUrl(response.body.imageUrl);
        setTotpSecret(response.body.totpSecret);
      } catch (error) {
        toast.error(error?.message, getToastStyleProps());
      } finally {
        setIsGenerating(false);
      }
    }
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

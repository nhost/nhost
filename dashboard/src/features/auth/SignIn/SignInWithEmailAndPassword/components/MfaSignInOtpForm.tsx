import { MfaOtpForm } from '@/components/common/MfaOtpForm';
import { Smartphone } from 'lucide-react';

interface Props {
  sendMfaOtp: (code: string) => Promise<void>;
  loading: boolean;
  requestNewMfaTicket: () => Promise<void>;
}

function MfaSignInOtpForm({ sendMfaOtp, loading, requestNewMfaTicket }: Props) {
  return (
    <div className="ws-full relative grid grid-flow-row gap-4 bg-transparent">
      <div className="flex w-full flex-col items-center justify-center gap-3">
        <Smartphone size={32} />
        <h2 className="text-[1.25rem]">Authentication Code</h2>
      </div>
      <MfaOtpForm
        loading={loading}
        sendMfaOtp={sendMfaOtp}
        requestNewMfaTicket={requestNewMfaTicket}
      />
      <p className="text-center">
        Open your authenticator app or browser extension to view your
        authentication code.
      </p>
    </div>
  );
}

export default MfaSignInOtpForm;

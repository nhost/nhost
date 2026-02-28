import {
  type ChangeEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/v3/button';
import { Input } from '@/components/ui/v3/input';
import { getToastStyleProps } from '@/utils/constants/settings';

interface Props {
  sendMfaOtp: (code: string) => Promise<unknown>;
  loading: boolean;
  requestNewMfaTicket?: () => Promise<unknown>;
}

function MfaOtpForm({ sendMfaOtp, loading, requestNewMfaTicket }: Props) {
  const [otpValue, setOtpValue] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isMfaTicketInvalid = useRef(false);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  async function submitTOTP() {
    if (otpValue.length === 6 && !isSubmitting) {
      try {
        setIsSubmitting(true);

        if (requestNewMfaTicket && isMfaTicketInvalid.current) {
          await requestNewMfaTicket();
        }
        await sendMfaOtp(otpValue);
      } catch (error) {
        isMfaTicketInvalid.current = true;
        toast.error(
          error?.message || 'An error occurred. Please try again.',
          getToastStyleProps(),
        );
        setTimeout(() => {
          inputRef.current?.focus();
        }, 10);
      } finally {
        setIsSubmitting(false);
      }
    }
  }

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const code = event.target.value.replace(/[^0-9]/g, '');
    setOtpValue(code);
  }

  async function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      submitTOTP();
    }
  }

  const isInputDisabled = loading || isSubmitting;
  const isButtonDisabled = isInputDisabled || otpValue.length !== 6;

  return (
    <div className="relative grid w-full grid-flow-row gap-4 bg-transparent">
      <Input
        ref={inputRef}
        value={otpValue}
        placeholder="Enter TOTP"
        className="!bg-transparent"
        disabled={isInputDisabled}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
      <Button disabled={isButtonDisabled} onClick={submitTOTP}>
        {loading ? 'Verifying...' : 'Verify'}
      </Button>
    </div>
  );
}

export default MfaOtpForm;

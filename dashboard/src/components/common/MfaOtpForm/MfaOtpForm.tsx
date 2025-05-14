import { Button } from '@/components/ui/v3/button';
import { Input } from '@/components/ui/v3/input';
import { type ChangeEvent, useEffect, useRef, useState } from 'react';

interface Props {
  sendMfaOtp: (code: string) => Promise<any>;
  loading: boolean;
}

function MfaOtpForm({ sendMfaOtp, loading }: Props) {
  const [otpValue, setOtpValue] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  async function sendMfa(code: string) {
    if (code.length === 6 && !isSubmitting) {
      setIsSubmitting(true);
      const result = await sendMfaOtp(code);
      if (!result) {
        setTimeout(() => {
          inputRef.current?.focus();
        }, 10);
      }
    }
    setIsSubmitting(false);
  }

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const code = event.target.value.replace(/[^0-9]/g, '').slice(0, 6);
    setOtpValue(code);

    sendMfa(code);
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
      />
      <Button disabled={isButtonDisabled}>
        {loading ? 'Verifying...' : 'Verify'}
      </Button>
    </div>
  );
}

export default MfaOtpForm;

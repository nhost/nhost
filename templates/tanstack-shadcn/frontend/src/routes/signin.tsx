import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { type FormEvent, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { nhost } from '@/lib/nhost/client';
import { isSafeInternalRedirect } from '@/lib/redirect';

export const Route = createFileRoute('/signin')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect:
      typeof search['redirect'] === 'string' ? search['redirect'] : undefined,
  }),
  component: SignIn,
});

type Step = 'email' | 'otp';

function SignIn() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const emailId = useId();
  const otpId = useId();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const handleSendOTP = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setIsLoading(true);
    setError(undefined);

    try {
      await nhost.auth.signInOTPEmail({ email });
      setStep('otp');
    } catch (err) {
      setError(`Could not send the code: ${(err as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setIsLoading(true);
    setError(undefined);

    try {
      const response = await nhost.auth.verifySignInOTPEmail({ email, otp });

      if (!response.body?.session) {
        setError('Invalid or expired code. Please try again.');
        return;
      }
    } catch (err) {
      setError(`Could not verify the code: ${(err as Error).message}`);
      return;
    } finally {
      setIsLoading(false);
    }

    const target =
      redirect && isSafeInternalRedirect(redirect) ? redirect : '/protected';

    await navigate({ to: target });
  };

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Enter your email and we will send you a one-time code. No account is
            needed — one is created the first time you sign in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'email' ? (
            <form onSubmit={handleSendOTP} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor={emailId}>Email</Label>
                <Input
                  id={emailId}
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>

              {error ? (
                <p className="text-destructive text-sm">{error}</p>
              ) : null}

              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Sending…' : 'Send code'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOTP} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor={otpId}>Verification code</Label>
                <Input
                  id={otpId}
                  name="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value)}
                  required
                />
                <p className="text-muted-foreground text-sm">
                  We sent a code to {email}.
                </p>
              </div>

              {error ? (
                <p className="text-destructive text-sm">{error}</p>
              ) : null}

              <div className="flex gap-2">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Verifying…' : 'Verify'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isLoading}
                  onClick={() => {
                    setStep('email');
                    setOtp('');
                    setError(undefined);
                  }}
                >
                  Use a different email
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

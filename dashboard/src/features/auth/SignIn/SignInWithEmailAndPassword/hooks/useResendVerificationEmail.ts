import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { appendPkceId, generateAndStorePKCE } from '@/lib/pkce';
import { useNhostClient } from '@/providers/nhost';
import { getToastStyleProps } from '@/utils/constants/settings';

const COOLDOWN_SECONDS = 60;
const COOLDOWN_PREFIX = 'nhost_resend_cooldown:';

function cooldownKey(email: string): string {
  return `${COOLDOWN_PREFIX}${email.trim().toLowerCase()}`;
}

/**
 * Read the cooldown deadline for an address.
 *
 * The deadline lives in sessionStorage so that bouncing between /signin and
 * /email/verify -- which remounts this hook -- doesn't hand the user a fresh
 * allowance on every round trip.
 */
function readCooldownDeadline(email: string | undefined): number {
  if (!email?.trim() || typeof window === 'undefined') {
    return 0;
  }

  const deadline = Number(window.sessionStorage.getItem(cooldownKey(email)));

  return Number.isFinite(deadline) && deadline > Date.now() ? deadline : 0;
}

export default function useResendVerificationEmail(email?: string) {
  const nhost = useNhostClient();
  const [loading, setLoading] = useState(false);
  const [deadline, setDeadline] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // Seeded inside the effect rather than in useState so the server-rendered
  // markup matches the first client render.
  useEffect(() => {
    const storedDeadline = readCooldownDeadline(email);
    setDeadline(storedDeadline);

    if (storedDeadline > 0) {
      setCurrentTime(Date.now());
    }
  }, [email]);

  useEffect(() => {
    if (deadline <= Date.now()) {
      return undefined;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      setCurrentTime(now);

      if (deadline <= now) {
        setDeadline(0);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [deadline]);

  const secondsRemaining =
    deadline > currentTime ? Math.ceil((deadline - currentTime) / 1000) : 0;

  const startCooldown = useCallback((target: string, seconds: number) => {
    const now = Date.now();
    const nextDeadline = now + seconds * 1000;
    window.sessionStorage.setItem(cooldownKey(target), String(nextDeadline));
    setCurrentTime(now);
    setDeadline(nextDeadline);
  }, []);

  const resendVerificationEmail = async (target: string) => {
    if (readCooldownDeadline(target) > 0) {
      return;
    }

    setLoading(true);

    try {
      const { challenge, id } = await generateAndStorePKCE();

      await nhost.auth.sendVerificationEmail({
        email: target,
        codeChallenge: challenge,
        options: {
          redirectTo: appendPkceId(window.location.origin, id),
        },
      });

      startCooldown(target, COOLDOWN_SECONDS);

      toast.success(
        `A verification email has been sent to ${target}. Please follow the link in the most recent email to complete your registration.`,
        getToastStyleProps(),
      );
    } catch (error) {
      // The rate limiter aborts with an empty body, so there is no error code
      // to read -- only the status tells these apart.
      if (error?.status === 429) {
        startCooldown(target, COOLDOWN_SECONDS);

        toast.error(
          'Too many verification emails requested. Please wait a moment before trying again, and check your spam folder in the meantime.',
          getToastStyleProps(),
        );

        return;
      }

      toast.error(
        'An error occurred while sending the verification email. Please try again.',
        getToastStyleProps(),
      );
    } finally {
      setLoading(false);
    }
  };

  return { resendVerificationEmail, loading, secondsRemaining };
}

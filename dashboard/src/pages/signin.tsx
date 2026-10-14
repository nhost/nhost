import { Mail } from 'lucide-react';
import NextLink from 'next/link';
import {
  type PropsWithChildren,
  type ReactElement,
  useEffect,
  useId,
} from 'react';
import { SignInRightColumn } from '@/components/auth/SignInRightColumn';
import { UnauthenticatedLayout } from '@/components/layout/UnauthenticatedLayout';
import { Button } from '@/components/ui/v3/button';
import { Separator } from '@/components/ui/v3/separator';
import { TextLink } from '@/components/ui/v3/text-link';
import { LastUsedBadge } from '@/features/auth/SignIn/components/LastUsedBadge';
import { SignInWithSecurityKey } from '@/features/auth/SignIn/SecurityKey';
import { SignInWithGithub } from '@/features/auth/SignIn/SignInWithGithub';
import { useLastSignInMethod } from '@/features/auth/SignIn/utils/lastSignInMethod';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/Auth';

const lastUsedOutline = 'outline outline-2 outline-offset-2 outline-border';

function SignInOption({
  isLastUsed,
  badgeId,
  children,
}: PropsWithChildren<{ isLastUsed: boolean; badgeId: string }>) {
  return (
    <div className="relative">
      {children}
      {isLastUsed && <LastUsedBadge id={badgeId} />}
    </div>
  );
}

export default function SigninPage() {
  const { isSigningOut, clearIsSigningOut } = useAuth();
  const lastUsedBadgeId = useId();
  const lastSignInMethod = useLastSignInMethod();
  const isGithubLastUsed = lastSignInMethod === 'github';
  const isSecurityKeyLastUsed = lastSignInMethod === 'security-key';
  const isEmailLastUsed = lastSignInMethod === 'email';

  // biome-ignore lint/correctness/useExhaustiveDependencies: onmounted
  useEffect(() => {
    if (isSigningOut) {
      clearIsSigningOut();
    }
  }, []);

  return (
    <div className="grid gap-12">
      <div className="text-center">
        <h2 className="mb-3 font-semibold text-3.5xl lg:text-4.5xl">
          Welcome back
        </h2>
        <p className="mx-auto max-w-md text-lg text-muted-foreground">
          Continue building amazing things with Nhost
        </p>
      </div>

      <div className="grid grid-flow-row gap-4 rounded-md border bg-transparent p-6 lg:p-12">
        <SignInOption isLastUsed={isGithubLastUsed} badgeId={lastUsedBadgeId}>
          <SignInWithGithub
            className={cn(isGithubLastUsed && lastUsedOutline)}
            aria-describedby={isGithubLastUsed ? lastUsedBadgeId : undefined}
          />
        </SignInOption>

        <SignInOption
          isLastUsed={isSecurityKeyLastUsed}
          badgeId={lastUsedBadgeId}
        >
          <SignInWithSecurityKey
            className={cn(isSecurityKeyLastUsed && lastUsedOutline)}
            aria-describedby={
              isSecurityKeyLastUsed ? lastUsedBadgeId : undefined
            }
          />
        </SignInOption>

        <div className="relative py-2">
          <p className="absolute top-1/2 right-0 left-0 mx-auto w-12 -translate-y-1/2 bg-background px-2 text-center text-muted-foreground text-sm">
            OR
          </p>

          <Separator className="my-2" />
        </div>

        <SignInOption isLastUsed={isEmailLastUsed} badgeId={lastUsedBadgeId}>
          <Button
            asChild
            variant="outline-emboss"
            className={cn(
              'w-full gap-2 text-sm+',
              isEmailLastUsed && lastUsedOutline,
            )}
            aria-describedby={isEmailLastUsed ? lastUsedBadgeId : undefined}
          >
            <NextLink href="/signin/email">
              <Mail size={14} />
              Continue with Email
            </NextLink>
          </Button>
        </SignInOption>
        <p className="text-center text-sm">
          By clicking continue, you agree to our{' '}
          <TextLink
            href="https://nhost.io/legal/terms-of-service"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold"
          >
            Terms of Service
          </TextLink>{' '}
          and{' '}
          <TextLink
            href="https://nhost.io/legal/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold"
          >
            Privacy Policy
          </TextLink>
        </p>
      </div>

      <div className="rounded-md border bg-transparent p-4 text-center lg:text-lg">
        Don&apos;t have an account?{' '}
        <TextLink href="/signup" className="font-medium">
          Sign Up
        </TextLink>
      </div>
    </div>
  );
}

SigninPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <UnauthenticatedLayout
      title="Sign In"
      rightColumnContent={<SignInRightColumn />}
    >
      {page}
    </UnauthenticatedLayout>
  );
};

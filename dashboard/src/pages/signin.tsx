import { Mail } from 'lucide-react';
import NextLink from 'next/link';
import { type ReactElement, useEffect } from 'react';
import { SignInRightColumn } from '@/components/auth/SignInRightColumn';
import { UnauthenticatedLayout } from '@/components/layout/UnauthenticatedLayout';
import { Button } from '@/components/ui/v3/button';
import { Separator } from '@/components/ui/v3/separator';
import { TextLink } from '@/components/ui/v3/text-link';
import { SignInWithSecurityKey } from '@/features/auth/SignIn/SecurityKey';
import { SignInWithGithub } from '@/features/auth/SignIn/SignInWithGithub';
import { useAuth } from '@/providers/Auth';

export default function SigninPage() {
  const { isSigningOut, clearIsSigningOut } = useAuth();

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
        <p className="mx-auto max-w-md text-muted-foreground text-lg">
          Continue building amazing things with Nhost
        </p>
      </div>

      <div className="grid grid-flow-row gap-4 rounded-md border bg-transparent p-6 lg:p-12">
        <SignInWithGithub />
        <SignInWithSecurityKey />
        <div className="relative py-2">
          <p className="absolute top-1/2 right-0 left-0 mx-auto w-12 -translate-y-1/2 bg-background px-2 text-center text-muted-foreground text-sm">
            OR
          </p>

          <Separator className="my-2" />
        </div>
        <Button variant="outline-emboss" className="gap-2 text-sm+" asChild>
          <NextLink href="/signin/email">
            <Mail size={14} />
            Continue with Email
          </NextLink>
        </Button>
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

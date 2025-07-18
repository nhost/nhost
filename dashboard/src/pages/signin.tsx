import { UnauthenticatedLayout } from '@/components/layout/UnauthenticatedLayout';
import { Divider } from '@/components/ui/v2/Divider';
import { Button } from '@/components/ui/v3/button';
import { SignInWithSecurityKey } from '@/features/auth/SignIn/SecurityKey';
import { SignInWithGithub } from '@/features/auth/SignIn/SignInWithGithub';
import NextLink from 'next/link';
import type { ReactElement } from 'react';

export default function SigninPage() {
  return (
    <div className="grid gap-12 font-[Inter]">
      <h2 className="text-center text-3.5xl font-semibold lg:text-4.5xl">
        It&apos;s time to build
      </h2>

      <div className="grid grid-flow-row gap-4 rounded-md border bg-transparent p-6 lg:p-12">
        <SignInWithGithub />
        <SignInWithSecurityKey />
        <div className="relative py-2">
          <p className="absolute left-0 right-0 top-1/2 mx-auto w-12 -translate-y-1/2 bg-black px-2 text-center text-sm text-[#68717A]">
            OR
          </p>

          <Divider className="!my-2" />
        </div>
        <Button
          variant="ghost"
          className="!text-white hover:!bg-white hover:!bg-opacity-10 focus:!bg-white focus:!bg-opacity-10"
        >
          <NextLink href="/signin/email">Continue with Email</NextLink>
        </Button>
        <p className="text-center text-sm">
          By clicking continue, you agree to our{' '}
          <NextLink
            href="https://nhost.io/legal/terms-of-service"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-white"
          >
            Terms of Service
          </NextLink>{' '}
          and{' '}
          <NextLink
            href="https://nhost.io/legal/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-white"
          >
            Privacy Policy
          </NextLink>
        </p>
      </div>

      <p className="text-center lg:text-lg">
        Don&apos;t have an account?{' '}
        <NextLink href="/signup" className="font-medium text-white">
          Sign Up
        </NextLink>
      </p>
    </div>
  );
}

SigninPage.getLayout = function getLayout(page: ReactElement) {
  return <UnauthenticatedLayout title="Sign In">{page}</UnauthenticatedLayout>;
};

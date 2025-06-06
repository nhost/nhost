import { UnauthenticatedLayout } from '@/components/layout/UnauthenticatedLayout';
import { Divider } from '@/components/ui/v2/Divider';
import { SignUpTabs } from '@/features/auth/SignUp/SignUpTabs';
import { SignUpWithEmailAndPasswordForm } from '@/features/auth/SignUp/SignUpTabs/SignUpWithEmailAndPassword';
import { SignUpWithGithub } from '@/features/auth/SignUp/SignUpWithGithub';
import NextLink from 'next/link';
import type { ReactElement } from 'react';

export default function SignUpPage() {
  return (
    <div className="flex flex-col gap-12 font-[Inter]">
      <h1 className="text-center text-3.5xl font-semibold lg:text-4.5xl">
        Sign Up
      </h1>

      <div className="grid grid-flow-row gap-4 rounded-md border bg-transparent p-6 lg:p-12">
        <SignUpWithGithub />

        <div className="relative py-2">
          <p className="absolute left-0 right-0 top-1/2 mx-auto w-12 -translate-y-1/2 bg-black px-2 text-center text-sm text-[#68717A]">
            OR
          </p>

          <Divider />
        </div>
        {/* TODO: https://github.com/nhost/nhost/issues/3340 */}
        <SignUpTabs />
        {false && <SignUpWithEmailAndPasswordForm />}
        <Divider className="!my-2" />
        <p className="text-center text-sm text-[#A2B3BE]">
          By signing up, you agree to our{' '}
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
            rel="noopener noreferrer"
            className="font-semibold text-white"
          >
            Privacy Policy
          </NextLink>
        </p>
      </div>

      <p className="text-center text-base text-[#A2B3BE] lg:text-lg">
        Already have an account?{' '}
        <NextLink href="/signin" className="font-medium text-white">
          Sign In
        </NextLink>
      </p>
    </div>
  );
}

SignUpPage.getLayout = function getLayout(page: ReactElement) {
  return <UnauthenticatedLayout title="Sign Up">{page}</UnauthenticatedLayout>;
};

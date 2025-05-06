import { NavLink } from '@/components/common/NavLink';
import { UnauthenticatedLayout } from '@/components/layout/UnauthenticatedLayout';
import { Divider } from '@/components/ui/v2/Divider';
import { SignUpTabs } from '@/features/auth/SignUp/SignUpTabs';
import { SignUpWithGithub } from '@/features/auth/SignUp/SignUpWithGithub';
import type { ReactElement } from 'react';

export default function SignUpPage() {
  return (
    <>
      <h1 className="text-center text-3.5xl font-semibold lg:text-4.5xl">
        Sign Up
      </h1>

      <div className="grid grid-flow-row gap-4 rounded-md border bg-transparent p-6 lg:p-12">
        <SignUpWithGithub />

        <div className="relative py-2">
          <p
            className="absolute left-0 right-0 top-1/2 mx-auto w-12 -translate-y-1/2 bg-black px-2 text-center text-sm"
            color="disabled"
          >
            OR
          </p>

          <Divider />
        </div>
        <SignUpTabs />
      </div>

      <p className="text-center text-base lg:text-lg">
        Already have an account?{' '}
        <NavLink href="/signin" color="white" className="font-medium">
          Sign In
        </NavLink>
      </p>
    </>
  );
}

SignUpPage.getLayout = function getLayout(page: ReactElement) {
  return <UnauthenticatedLayout title="Sign Up">{page}</UnauthenticatedLayout>;
};

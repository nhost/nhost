import type { ReactElement } from 'react';
import { SignInRightColumn } from '@/components/auth/SignInRightColumn';
import { NavLink } from '@/components/common/NavLink';
import { UnauthenticatedLayout } from '@/components/layout/UnauthenticatedLayout';
import { SignInWithEmailAndPassword } from '@/features/auth/SignIn/SignInWithEmailAndPassword';

function SigninPage() {
  return (
    <div className="grid gap-12 font-[Inter]">
      <div className="text-center">
        <h1 className="mb-3 font-semibold text-3.5xl lg:text-4.5xl">
          Welcome back
        </h1>
        <p className="mx-auto max-w-md text-[#A2B3BE] text-lg">
          Continue building amazing things with Nhost
        </p>
      </div>

      <div className="grid grid-flow-row gap-4 rounded-md border bg-transparent p-6 lg:p-12">
        <SignInWithEmailAndPassword />
      </div>

      <p className="text-center text-base lg:text-lg">
        Don&apos;t have an account?{' '}
        <NavLink href="/signup" className="px-0 text-[1.125rem] text-inherit">
          Sign Up
        </NavLink>
      </p>
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

export default SigninPage;

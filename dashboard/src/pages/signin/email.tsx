import { SignInRightColumn } from '@/components/auth/SignInRightColumn';
import { NavLink } from '@/components/common/NavLink';
import { UnauthenticatedLayout } from '@/components/layout/UnauthenticatedLayout';
import { SignInWithEmailAndPassword } from '@/features/auth/SignIn/SignInWithEmailAndPassword';
import type { ReactElement } from 'react';

function SigninPage() {
  return (
    <div className="grid gap-12 font-[Inter]">
      <div className="text-center">
        <h1 className="mb-3 text-3.5xl font-semibold lg:text-4.5xl">
          Welcome back
        </h1>
        <p className="mx-auto max-w-md text-lg text-[#A2B3BE]">
          Continue building amazing things with Nhost
        </p>
      </div>

      <div className="grid grid-flow-row gap-4 rounded-md border bg-transparent p-6 lg:p-12">
        <SignInWithEmailAndPassword />
      </div>

      <p className="text-center text-base lg:text-lg">
        Don&apos;t have an account?{' '}
        <NavLink href="/signup" color="white">
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

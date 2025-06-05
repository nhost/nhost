import { NavLink } from '@/components/common/NavLink';
import { UnauthenticatedLayout } from '@/components/layout/UnauthenticatedLayout';
import { SignInWithEmailAndPassword } from '@/features/auth/SignIn/SignInWithEmailAndPassword';
import type { ReactElement } from 'react';

function SigninPage() {
  return (
    <div className="grid gap-12 font-[Inter]">
      <h1 className="text-center text-3.5xl font-semibold lg:text-4.5xl">
        Sign In
      </h1>
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
  return <UnauthenticatedLayout title="Sign Up">{page}</UnauthenticatedLayout>;
};

export default SigninPage;

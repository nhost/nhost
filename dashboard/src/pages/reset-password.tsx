import UnauthenticatedLayout from '@/components/layout/UnauthenticatedLayout';
import { Button, Input, Text } from '@/ui';
import { useResetPassword } from '@nhost/nextjs';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactElement } from 'react';
import { useForm } from 'react-hook-form';

type ResetPasswordFormProps = {
  email: string;
};

function ResetPasswordForm() {
  const { resetPassword, isSent, isLoading, isError, error } =
    useResetPassword();

  const { register, handleSubmit, setValue, getValues } =
    useForm<ResetPasswordFormProps>({
      reValidateMode: 'onSubmit',
      defaultValues: {
        email: '',
      },
    });

  const onSubmit = async (data: ResetPasswordFormProps) => {
    const { email } = data;

    await resetPassword(email);
  };

  if (isSent) {
    return (
      <div className="text-center">
        We&apos;ve sent a temporary link to reset your password. Check your
        inbox at {getValues('email')}.
      </div>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col items-center">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex w-full flex-col space-y-3"
      >
        <div>
          <Text
            color="greyscaleDark"
            className="self-center font-medium"
            size="normal"
          >
            Email
          </Text>
          <div className="flex w-full">
            <Input
              {...register('email')}
              onChange={(v) => {
                setValue('email', v);
              }}
              autoFocus
              id="email"
              placeholder="Email"
              required
              minLength={2}
              maxLength={128}
              spellCheck="false"
              aria-label="email"
              autoCapitalize="none"
              type="email"
            />
          </div>
        </div>
        <div className="flex flex-col">
          <Button
            variant="primary"
            type="submit"
            disabled={isLoading}
            loading={isLoading}
          >
            Send Reset Instructions
          </Button>
        </div>
      </form>

      {isError && (
        <div className="my-3">
          <Text variant="item" size="small" className="font-medium text-red">
            Error: {error.message}
          </Text>
        </div>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex max-w-3xl flex-col">
        <div className="z-30 mb-8 flex justify-center">
          <a href="https://nhost.io" tabIndex={-1}>
            <Image
              src="/assets/Logo.svg"
              alt="Nhost Logo"
              width={185}
              height={64}
            />
          </a>
        </div>
        <div className="flex items-center justify-center">
          <div className="z-30">
            <div
              className="rounded-lg border border-gray-300 bg-white px-12 py-4"
              style={{ width: '480px' }}
            >
              <div className="my-4">
                <div className="mb-4 flex justify-center text-lg font-semibold">
                  Reset your password
                </div>
                <ResetPasswordForm />
              </div>
            </div>
            <div className="mt-3 flex justify-center">
              <div className="text-sm text-gray-700">
                Is your password okay?{' '}
                <Link href="/signin" passHref>
                  <a href="signin" className="text-btn hover:underline">
                    Sign in
                  </a>
                </Link>
              </div>
            </div>
          </div>

          <div className="absolute z-0 w-full max-w-[887px]">
            <Image
              src="/assets/signup/bg-gradient.svg"
              alt="Gradient background"
              width={887}
              height={620}
              layout="responsive"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

ResetPasswordPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <UnauthenticatedLayout title="Reset Password">{page}</UnauthenticatedLayout>
  );
};

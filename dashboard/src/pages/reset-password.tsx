import UnauthenticatedLayout from '@/components/layout/UnauthenticatedLayout';
import Box from '@/ui/v2/Box';
import Button from '@/ui/v2/Button';
import Input from '@/ui/v2/Input';
import Link from '@/ui/v2/Link';
import Text from '@/ui/v2/Text';
import { useTheme } from '@mui/material';
import { useResetPassword } from '@nhost/nextjs';
import Image from 'next/image';
import NavLink from 'next/link';
import type { ReactElement } from 'react';
import { useForm } from 'react-hook-form';

type ResetPasswordFormProps = {
  email: string;
};

function ResetPasswordForm() {
  const { resetPassword, isSent, isLoading, isError, error } =
    useResetPassword();

  const { register, handleSubmit, getValues } = useForm<ResetPasswordFormProps>(
    {
      reValidateMode: 'onSubmit',
      defaultValues: {
        email: '',
      },
    },
  );

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
        <Input
          {...register('email')}
          autoFocus
          id="email"
          label="Email"
          placeholder="Email"
          required
          fullWidth
          inputProps={{ min: 2, max: 128 }}
          spellCheck="false"
          autoCapitalize="none"
          type="email"
        />

        <div className="flex flex-col">
          <Button type="submit" disabled={isLoading} loading={isLoading}>
            Send Reset Instructions
          </Button>
        </div>
      </form>

      {isError && (
        <div className="my-3">
          <Text className="font-medium" color="error">
            Error: {error.message}
          </Text>
        </div>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  const theme = useTheme();

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex max-w-3xl flex-col">
        <div className="z-30 mb-8 flex justify-center">
          <a href="https://nhost.io" tabIndex={-1}>
            <Image
              src={
                theme.palette.mode === 'dark'
                  ? '/assets/brands/light/nhost-with-text.svg'
                  : '/assets/brands/nhost-with-text.svg'
              }
              alt="Nhost Logo"
              width={185}
              height={64}
            />
          </a>
        </div>
        <div className="flex items-center justify-center">
          <div className="z-30">
            <Box
              className="rounded-lg border px-12 py-4"
              style={{ width: '480px' }}
            >
              <div className="my-4">
                <div className="mb-4 flex justify-center text-lg font-semibold">
                  Reset your password
                </div>
                <ResetPasswordForm />
              </div>
            </Box>

            <div className="mt-3 flex justify-center">
              <div className="grid grid-flow-col items-center justify-center gap-1">
                <Text className="text-sm">Is your password okay?</Text>

                <NavLink href="/signin" passHref>
                  <Link href="signin" underline="hover">
                    Sign in
                  </Link>
                </NavLink>
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

import { NavLink } from '@/components/common/NavLink';
import { UnauthenticatedLayout } from '@/components/layout/UnauthenticatedLayout';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Text } from '@/components/ui/v2/Text';
import { getToastStyleProps } from '@/utils/constants/settings';
import { useNhostClient } from '@nhost/nextjs';
import { useRouter } from 'next/router';
import { useEffect, useState, type ReactElement } from 'react';
import { toast } from 'react-hot-toast';

export default function VerifyEmailPage() {
  const router = useRouter();
  const nhost = useNhostClient();

  const {
    query: { email },
  } = router;

  const [resendVerificationEmailLoading, setResendVerificationEmailLoading] =
    useState(false);

  useEffect(() => {
    if (!email) {
      router.push('/signin');
    }
  }, [email, router]);

  const resendVerificationEmail = async () => {
    setResendVerificationEmailLoading(true);

    try {
      await nhost.auth.sendVerificationEmail({ email: email as string });

      toast.success(
        `An new email has been sent to ${email}. Please follow the link to verify your email address and to
      complete your registration.`,
        getToastStyleProps(),
      );
    } catch {
      toast.error(
        'An error occurred while sending the verification email. Please try again.',
        getToastStyleProps(),
      );
    } finally {
      setResendVerificationEmailLoading(false);
    }
  };

  return (
    <>
      <Text
        variant="h2"
        component="h1"
        className="text-center text-3.5xl font-semibold lg:text-4.5xl"
      >
        Verify your email
      </Text>

      <Box className="grid grid-flow-row gap-4 rounded-md border bg-transparent p-6 lg:p-12">
        <div className="relative py-2">
          <Text color="secondary" className="text-center text-sm">
            Please check your inbox for the verification email. Follow the link
            to verify your email address and complete your registration.
          </Text>
        </div>
        <Button
          className="!bg-white !text-black disabled:!text-black disabled:!text-opacity-60"
          size="large"
          disabled={resendVerificationEmailLoading}
          loading={resendVerificationEmailLoading}
          type="button"
          onClick={resendVerificationEmail}
        >
          Resend verification email
        </Button>

        <div className="flex justify-center">
          <NavLink href="/signin" color="white" className="font-medium">
            Sign In
          </NavLink>
        </div>
      </Box>
    </>
  );
}

VerifyEmailPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <UnauthenticatedLayout title="Verify your email">
      {page}
    </UnauthenticatedLayout>
  );
};

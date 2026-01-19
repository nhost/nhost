import { useRouter } from 'next/router';
import type { ReactElement } from 'react';
import { NavLink } from '@/components/common/NavLink';
import { UnauthenticatedLayout } from '@/components/layout/UnauthenticatedLayout';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Text } from '@/components/ui/v2/Text';
import SendVerificationEmailForm from '@/features/auth/SignIn/SignInWithEmailAndPassword/components/SendVerificationEmailForm';
import useResendVerificationEmail from '@/features/auth/SignIn/SignInWithEmailAndPassword/hooks/useResendVerificationEmail';

export default function VerifyEmailPage() {
  const router = useRouter();

  const {
    query: { email },
  } = router;

  const { resendVerificationEmail, loading: resendVerificationEmailLoading } =
    useResendVerificationEmail();

  const handleResendEmailClick = async () => {
    await resendVerificationEmail(email as string);
  };

  return (
    <>
      <Text
        variant="h2"
        component="h1"
        className="text-center font-semibold text-3.5xl lg:text-4.5xl"
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
        {email ? (
          <Button
            className="!bg-white !text-black disabled:!text-black disabled:!text-opacity-60"
            size="large"
            disabled={resendVerificationEmailLoading}
            loading={resendVerificationEmailLoading}
            type="button"
            onClick={handleResendEmailClick}
          >
            Resend verification email
          </Button>
        ) : (
          <SendVerificationEmailForm />
        )}

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

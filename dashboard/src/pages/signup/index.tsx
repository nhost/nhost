import GithubIcon from '@/components/icons/GithubIcon';
import UnauthenticatedLayout from '@/components/layout/UnauthenticatedLayout';
import Box from '@/ui/v2/Box';
import Button from '@/ui/v2/Button';
import Divider from '@/ui/v2/Divider';
import Link from '@/ui/v2/Link';
import Text from '@/ui/v2/Text';
import { nhost } from '@/utils/nhost';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { toast } from 'react-hot-toast';

export default function SignUpPage() {
  const [loading, setLoading] = useState(false);

  return (
    <>
      <Text
        variant="h2"
        component="h1"
        className="text-center text-4.5xl font-semibold"
      >
        It&apos;s time to build
      </Text>

      <Box className="grid grid-flow-row gap-4 rounded-md border bg-transparent p-12">
        <Button
          className="!bg-white !text-black disabled:!text-black disabled:!text-opacity-60"
          startIcon={<GithubIcon />}
          size="large"
          disabled={loading}
          loading={loading}
          onClick={async () => {
            setLoading(true);

            try {
              await nhost.auth.signIn({ provider: 'github' });
            } catch {
              toast.error(
                `An error occurred while trying to sign in using GitHub. Please try again later.`,
                getToastStyleProps(),
              );
            } finally {
              setLoading(false);
            }
          }}
        >
          Continue with GitHub
        </Button>

        <Button
          variant="borderless"
          className="!text-white hover:!bg-white hover:!bg-opacity-10 focus:!bg-white focus:!bg-opacity-10"
          size="large"
          href="/signup/email"
        >
          Continue with Email
        </Button>

        <Divider />

        <Text color="secondary" className="text-center text-sm">
          By clicking continue, you agree to our{' '}
          <Link
            href="https://nhost.io/legal/terms-of-service"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold"
            color="white"
          >
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link
            href="https://nhost.io/legal/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold"
            color="white"
          >
            Privacy Policy
          </Link>
        </Text>
      </Box>

      <Text color="secondary" className="text-center text-lg">
        Already have an account?{' '}
        <Link href="/signin" color="White">
          Sign in
        </Link>
      </Text>
    </>
  );
}

SignUpPage.getLayout = function getLayout(page: ReactElement) {
  return <UnauthenticatedLayout title="Sign Up">{page}</UnauthenticatedLayout>;
};

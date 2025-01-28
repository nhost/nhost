import { NavLink } from '@/components/common/NavLink';
import { UnauthenticatedLayout } from '@/components/layout/UnauthenticatedLayout';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Divider } from '@/components/ui/v2/Divider';
import { GitHubIcon } from '@/components/ui/v2/icons/GitHubIcon';
import { Text } from '@/components/ui/v2/Text';
import { useHostName } from '@/features/projects/common/hooks/useHostName';
import { getToastStyleProps } from '@/utils/constants/settings';
import { nhost } from '@/utils/nhost';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { toast } from 'react-hot-toast';

export default function SignUpPage() {
  const [loading, setLoading] = useState(false);

  const redirectTo = useHostName();

  return (
    <>
      <Text
        variant="h2"
        component="h1"
        className="text-center text-3.5xl font-semibold lg:text-4.5xl"
      >
        It&apos;s time to build
      </Text>

      <Box className="grid grid-flow-row gap-4 rounded-md border bg-transparent p-6 lg:p-12">
        <Button
          className="!bg-white !text-black hover:ring-2 hover:ring-white hover:ring-opacity-50 disabled:!text-black disabled:!text-opacity-60"
          startIcon={<GitHubIcon />}
          size="large"
          disabled={loading}
          loading={loading}
          onClick={async () => {
            setLoading(true);

            try {
              await nhost.auth.signIn({
                provider: 'github',
                options: { redirectTo },
              });
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
          href="/signin/email"
          LinkComponent={NavLink}
        >
          Continue with Email
        </Button>

        <Divider className="!my-2" />

        <Text color="secondary" className="text-center text-sm">
          By clicking continue, you agree to our{' '}
          <NavLink
            href="https://nhost.io/legal/terms-of-service"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold"
            color="white"
          >
            Terms of Service
          </NavLink>{' '}
          and{' '}
          <NavLink
            href="https://nhost.io/legal/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold"
            color="white"
          >
            Privacy Policy
          </NavLink>
        </Text>
      </Box>

      <Text color="secondary" className="text-center lg:text-lg">
        Don&apos;t have an account?{' '}
        <NavLink href="/signup" color="white" className="font-medium">
          Sign Up
        </NavLink>
      </Text>
    </>
  );
}

SignUpPage.getLayout = function getLayout(page: ReactElement) {
  return <UnauthenticatedLayout title="Sign In">{page}</UnauthenticatedLayout>;
};

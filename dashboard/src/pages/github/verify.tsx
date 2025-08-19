import { NavLink } from '@/components/common/NavLink';
import { UnauthenticatedLayout } from '@/components/layout/UnauthenticatedLayout';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Text } from '@/components/ui/v2/Text';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import { Input } from '@/components/ui/v3/input';
import useResendVerificationEmail from '@/features/auth/SignIn/SignInWithEmailAndPassword/hooks/useResendVerificationEmail';
import { zodResolver } from '@hookform/resolvers/zod';
import { type ReactElement } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const emailFormSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export default function VerifyGitHubEmailPage() {
  const { resendVerificationEmail } = useResendVerificationEmail();

  const form = useForm<z.infer<typeof emailFormSchema>>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof emailFormSchema>) => {
    await resendVerificationEmail(values.email);
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
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Box className="grid grid-flow-row gap-4 rounded-md border bg-transparent p-6 lg:p-12">
            <div className="relative py-2">
              <Text color="secondary" className="text-center text-sm">
                Please check your inbox for the verification email. Follow the
                link to verify your email address and complete your
                registration.
              </Text>
            </div>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="name@company.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              className="!bg-white !text-black disabled:!text-black disabled:!text-opacity-60"
              size="large"
              loading={form.formState.isSubmitting}
              disabled={form.formState.isSubmitting}
              type="submit"
            >
              Resend verification email
            </Button>

            <div className="flex justify-center">
              <NavLink href="/signin" color="white" className="font-medium">
                Sign In
              </NavLink>
            </div>
          </Box>
        </form>
      </Form>
    </>
  );
}

VerifyGitHubEmailPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <UnauthenticatedLayout title="Verify your email">
      {page}
    </UnauthenticatedLayout>
  );
};

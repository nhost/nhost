import { yupResolver } from '@hookform/resolvers/yup';
import { Turnstile } from '@marsidev/react-turnstile';
import { styled } from '@mui/material';
import { type ReactElement, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import * as Yup from 'yup';
import { NavLink } from '@/components/common/NavLink';
import { Form } from '@/components/form/Form';
import { UnauthenticatedLayout } from '@/components/layout/UnauthenticatedLayout';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Input, inputClasses } from '@/components/ui/v2/Input';
import { Text } from '@/components/ui/v2/Text';
import { useNhostClient } from '@/providers/nhost';
import { getToastStyleProps } from '@/utils/constants/settings';

const validationSchema = Yup.object({
  email: Yup.string().label('Email').email().required(),
  turnstileToken: Yup.string()
    .label('Verification')
    .required('Please complete the CAPTCHA'),
});

export type NewPasswordFormValues = Yup.InferType<typeof validationSchema>;

const StyledInput = styled(Input)({
  backgroundColor: 'transparent',
  [`& .${inputClasses.input}`]: {
    backgroundColor: 'transparent !important',
  },
});

export default function NewPasswordPage() {
  const nhost = useNhostClient();
  const [isSent, setIsSent] = useState(false);

  const form = useForm<NewPasswordFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      email: '',
      turnstileToken: '',
    },
    resolver: yupResolver(validationSchema),
  });

  const { register, formState, getValues, setValue } = form;

  async function handleSubmit({
    email,
    turnstileToken,
  }: NewPasswordFormValues) {
    try {
      await nhost.auth.sendPasswordResetEmail(
        {
          email,
          options: {
            redirectTo: `${window.location.origin}/password/reset`,
          },
        },
        {
          headers: {
            'x-cf-turnstile-response': turnstileToken,
          },
        },
      );
      setIsSent(true);
    } catch {
      toast.error(
        'An error occurred while resetting password. Please try again.',
        getToastStyleProps(),
      );
    }
  }

  if (isSent) {
    return (
      <div className="text-center">
        We&apos;ve sent a temporary link to reset your password. Check your
        inbox at {getValues('email')}.
      </div>
    );
  }

  return (
    <>
      <Text
        variant="h2"
        component="h1"
        className="text-center font-semibold text-3.5xl lg:text-4.5xl"
      >
        Reset Password
      </Text>

      <Box className="grid grid-flow-row gap-4 rounded-md border bg-transparent p-6 lg:p-12">
        <FormProvider {...form}>
          <Form
            onSubmit={handleSubmit}
            className="grid grid-flow-row gap-4 bg-transparent"
          >
            <StyledInput
              {...register('email')}
              type="email"
              id="email"
              label="Email"
              placeholder="Email"
              fullWidth
              autoFocus
              inputProps={{ min: 2, max: 128 }}
              error={!!formState.errors.email}
              helperText={formState.errors.email?.message}
            />

            <Box className="grid grid-flow-row gap-2">
              <Text variant="body2" className="text-sm">
                Verification
              </Text>
              <Turnstile
                siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
                options={{ theme: 'dark', size: 'flexible' }}
                onSuccess={(token) => {
                  setValue('turnstileToken', token, {
                    shouldValidate: true,
                  });
                }}
                onError={() => {
                  setValue('turnstileToken', '', {
                    shouldValidate: true,
                  });
                }}
                onExpire={() => {
                  setValue('turnstileToken', '', {
                    shouldValidate: true,
                  });
                }}
              />
              {formState.errors.turnstileToken && (
                <Text variant="body2" className="text-red-500 text-sm">
                  {formState.errors.turnstileToken.message}
                </Text>
              )}
            </Box>

            <Button
              className="!bg-white !text-black disabled:!text-black disabled:!text-opacity-60"
              size="large"
              type="submit"
              disabled={formState.isSubmitting}
              loading={formState.isSubmitting}
            >
              Send Reset Instructions
            </Button>
          </Form>
        </FormProvider>
      </Box>

      <Text color="secondary" className="text-center text-base lg:text-lg">
        Is your password okay?{' '}
        <NavLink href="/signin/email" color="white" className="font-medium">
          Sign In
        </NavLink>
      </Text>
    </>
  );
}

NewPasswordPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <UnauthenticatedLayout title="Request Password Reset">
      {page}
    </UnauthenticatedLayout>
  );
};

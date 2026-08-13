import { yupResolver } from '@hookform/resolvers/yup';
import { Turnstile } from '@marsidev/react-turnstile';
import { type ReactElement, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import * as Yup from 'yup';
import { NavLink } from '@/components/common/NavLink';
import { Form } from '@/components/form/Form';
import { FormInput } from '@/components/form/FormInput';
import { UnauthenticatedLayout } from '@/components/layout/UnauthenticatedLayout';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import { appendPkceId, generateAndStorePKCE } from '@/lib/pkce';
import { useNhostClient } from '@/providers/nhost';
import { getToastStyleProps } from '@/utils/constants/settings';

const validationSchema = Yup.object({
  email: Yup.string().label('Email').email().required(),
  turnstileToken: Yup.string()
    .label('Verification')
    .required('Please complete the CAPTCHA'),
});

export type NewPasswordFormValues = Yup.InferType<typeof validationSchema>;

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

  const { formState, getValues, setValue } = form;

  async function handleSubmit({
    email,
    turnstileToken,
  }: NewPasswordFormValues) {
    try {
      const { challenge, id } = await generateAndStorePKCE();

      await nhost.auth.sendPasswordResetEmail(
        {
          email,
          codeChallenge: challenge,
          options: {
            redirectTo: appendPkceId(
              `${window.location.origin}/password/reset`,
              id,
            ),
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
      <h1 className="text-center font-semibold text-3.5xl lg:text-4.5xl">
        Reset Password
      </h1>

      <div className="grid grid-flow-row gap-4 rounded-md border bg-transparent p-6 lg:p-12">
        <FormProvider {...form}>
          <Form
            onSubmit={handleSubmit}
            className="grid grid-flow-row gap-4 [&&]:bg-transparent"
          >
            <FormInput
              control={form.control}
              name="email"
              type="email"
              label="Email"
              placeholder="Email"
              autoFocus
              className="!bg-transparent border-border text-white placeholder:text-white"
            />

            <div className="grid grid-flow-row gap-2">
              <p className="text-sm">Verification</p>
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
                <p className="text-red-500 text-sm">
                  {formState.errors.turnstileToken.message}
                </p>
              )}
            </div>

            <ButtonWithLoading
              className="!bg-white !text-black disabled:!text-black disabled:!text-opacity-60"
              size="lg"
              type="submit"
              disabled={formState.isSubmitting}
              loading={formState.isSubmitting}
            >
              Send Reset Instructions
            </ButtonWithLoading>
          </Form>
        </FormProvider>
      </div>

      <p className="text-center text-[#A2B3BE] text-base lg:text-lg">
        Is your password okay?{' '}
        <NavLink
          href="/signin/email"
          className="px-0 font-medium text-[1.125rem] text-white"
        >
          Sign In
        </NavLink>
      </p>
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

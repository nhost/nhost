import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/v2/Button';
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

const emailFormSchema = z.object({
  email: z.string().email('Invalid email address'),
});

function SendVerificationEmailForm() {
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
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
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
          className="!bg-white !text-black disabled:!text-black disabled:!text-opacity-60 w-full"
          size="large"
          loading={form.formState.isSubmitting}
          disabled={form.formState.isSubmitting}
          type="submit"
        >
          Resend verification email
        </Button>
      </form>
    </Form>
  );
}

export default SendVerificationEmailForm;

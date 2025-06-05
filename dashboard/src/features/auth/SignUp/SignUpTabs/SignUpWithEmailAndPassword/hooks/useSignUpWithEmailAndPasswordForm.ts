import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const validationSchema = z
  .object({
    email: z.string().email({ message: 'Invalid email address' }),
    password: z.string().min(1, { message: 'Password is required' }),
    displayName: z
      .string()
      .regex(
        /^[\p{L}\p{N}\p{S} ,.'-]+$/u,
        'Use only letters, numbers, symbols and basic punctuation',
      )
      .min(1, { message: 'Name is required' })
      .max(32, { message: 'Name must be 32 characters or less' }),
    turnstileToken: z
      .string()
      .min(1, { message: 'Please complete the CAPTCHA' }),
  })
  .required();

export type SignUpWithEmailAndPasswordFormValues = z.infer<
  typeof validationSchema
>;

function useSignUpWithEmailAndPasswordForm() {
  const form = useForm<SignUpWithEmailAndPasswordFormValues>({
    mode: 'onTouched',
    reValidateMode: 'onBlur',
    defaultValues: {
      email: '',
      password: '',
      displayName: '',
      turnstileToken: '',
    },
    resolver: zodResolver(validationSchema),
  });

  return form;
}

export default useSignUpWithEmailAndPasswordForm;

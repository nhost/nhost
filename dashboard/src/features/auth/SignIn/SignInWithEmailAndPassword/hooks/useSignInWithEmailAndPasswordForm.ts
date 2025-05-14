import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const validationSchema = z
  .object({
    email: z.string().email({ message: 'Invalid email address' }),
    password: z.string().min(1, { message: 'Password is required' }),
  })
  .required();

export type SignInWithEmailAndPasswordFormValues = z.infer<
  typeof validationSchema
>;

function useSignInWithEmailAndPasswordForm() {
  const form = useForm<SignInWithEmailAndPasswordFormValues>({
    mode: 'onTouched',
    reValidateMode: 'onBlur',
    defaultValues: {
      email: '',
      password: '',
    },
    resolver: zodResolver(validationSchema),
  });

  return form;
}

export default useSignInWithEmailAndPasswordForm;

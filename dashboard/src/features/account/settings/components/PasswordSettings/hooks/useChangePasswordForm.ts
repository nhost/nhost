import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const validationSchema = z
  .object({
    newPassword: z
      .string({
        required_error: 'This field is required.',
      })
      .min(1, 'This field is required.'),
    confirmPassword: z
      .string({
        required_error: 'This field is required.',
      })
      .min(1, 'This field is required.'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords must match.',
    path: ['confirmPassword'],
  });

export type ChangePasswordFormValues = z.infer<typeof validationSchema>;

function useChangePasswordForm() {
  const form = useForm<ChangePasswordFormValues>({
    mode: 'onTouched',
    reValidateMode: 'onBlur',
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
    resolver: zodResolver(validationSchema),
  });

  return form;
}

export default useChangePasswordForm;

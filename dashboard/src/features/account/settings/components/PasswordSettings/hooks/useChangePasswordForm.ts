import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const validationSchema = z
  .object({
    newPassword: z
      .string({
        error: 'This field is required.',
      })
      .min(1, 'This field is required.'),
    confirmPassword: z
      .string({
        error: 'This field is required.',
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
    // Errors show only after Save, so clicking in and out of an empty field
    // doesn't flag it. After that they update live as you fix them.
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
    resolver: zodResolver(validationSchema),
  });

  return form;
}

export default useChangePasswordForm;

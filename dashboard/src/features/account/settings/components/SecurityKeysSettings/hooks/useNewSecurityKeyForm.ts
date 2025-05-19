import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const validationSchema = z
  .object({
    nickname: z.string().min(1, { message: 'Nickname is required' }),
  })
  .required();

export type NewSecurityKeyFormValues = z.infer<typeof validationSchema>;

function useNewSecurityKeyForm() {
  const form = useForm<NewSecurityKeyFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      nickname: '',
    },
    resolver: zodResolver(validationSchema),
  });

  return form;
}

export default useNewSecurityKeyForm;

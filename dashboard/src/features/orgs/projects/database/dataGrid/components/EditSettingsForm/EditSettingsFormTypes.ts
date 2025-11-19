import { z } from 'zod';

export const validationSchema = z.object({
  name: z.string().min(1, { message: 'Name is required' }),
});

export const defaultFormValues: EditSettingsFormValues = {
  name: '',
};

export type EditSettingsFormValues = z.infer<typeof validationSchema>;

export type EditSettingsFormInitialValues = EditSettingsFormValues;

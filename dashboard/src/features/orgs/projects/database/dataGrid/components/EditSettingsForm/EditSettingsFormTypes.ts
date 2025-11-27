import { z } from 'zod';

export const validationSchema = z.object({
  isEnum: z.boolean(),
});

export const defaultFormValues: EditSettingsFormValues = {
  isEnum: false,
};

export type EditSettingsFormValues = z.infer<typeof validationSchema>;

export type EditSettingsFormInitialValues = EditSettingsFormValues;

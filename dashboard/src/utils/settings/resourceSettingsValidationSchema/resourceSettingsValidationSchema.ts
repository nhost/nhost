import * as Yup from 'yup';

export const resourceSettingsValidationSchema = Yup.object({
  enabled: Yup.boolean(),
  totalCPU: Yup.number().label('Total CPU').required().min(1).max(60),
  totalRAM: Yup.number().label('Total RAM').required().min(1).max(120),
  databaseCPU: Yup.number().label('Database CPU').required().min(0.25),
  databaseRAM: Yup.number().label('Database RAM').required().min(0.5),
  hasuraCPU: Yup.number().label('Hasura CPU').required().min(0.25),
  hasuraRAM: Yup.number().label('Hasura RAM').required().min(0.5),
  authCPU: Yup.number().label('Auth CPU').required().min(0.25),
  authRAM: Yup.number().label('Auth RAM').required().min(0.5),
  storageCPU: Yup.number().label('Storage CPU').required().min(0.25),
  storageRAM: Yup.number().label('Storage RAM').required().min(0.5),
});

export type ResourceSettingsFormValues = Yup.InferType<
  typeof resourceSettingsValidationSchema
>;

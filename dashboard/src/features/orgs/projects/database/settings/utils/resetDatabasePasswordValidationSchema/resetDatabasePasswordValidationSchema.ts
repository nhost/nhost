import * as yup from 'yup';
import YupPassword from 'yup-password';

YupPassword(yup);

/* Defining a schema for the password. */
export const resetDatabasePasswordValidationSchema = yup.object().shape({
  databasePassword: yup
    .string()
    .label('Database password')
    .min(12)
    .max(32)
    .required()
    .minNumbers(1)
    .minLowercase(1)
    .minUppercase(1),
});

export type ResetDatabasePasswordFormValues = yup.InferType<
  typeof resetDatabasePasswordValidationSchema
>;

export default resetDatabasePasswordValidationSchema;

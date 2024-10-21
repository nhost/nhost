import type { DialogFormProps } from '@/types/common';
import * as Yup from 'yup';

export const validationSchema = Yup.object({
  emails: Yup.array()
    .of(Yup.string().email('Invalid email address'))
    .nullable(),
});

export type IntegrationType =
  | 'email'
  | 'slack'
  | 'pagerduty'
  | 'webhooks'
  | 'discord';

export type ContactPointFormValues = Yup.InferType<typeof validationSchema>;

export interface ContactPointFormProps extends DialogFormProps {
  /**
   * if there is initialData then it's an update operation
   */
  initialData?: ContactPointFormValues;

  /**
   * Function to be called when the operation is cancelled.
   */
  onCancel?: VoidFunction;
  /**
   * Function to be called when the submit is successful.
   */
  onSubmit?: VoidFunction | ((args?: any) => Promise<any>);
}

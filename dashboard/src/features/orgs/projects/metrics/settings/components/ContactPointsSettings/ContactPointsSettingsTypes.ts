import * as Yup from 'yup';

export const validationSchema = Yup.object({
  emails: Yup.array()
    .of(
      Yup.object({
        email: Yup.string().email('Invalid email address'),
      }),
    )
    .nullable(),
  discord: Yup.array()
    .of(
      Yup.object({
        url: Yup.string().url('Invalid Discord URL'),
        avatarUrl: Yup.string().url('Invalid avatar URL'),
      }),
    )
    .nullable(),
  pagerduty: Yup.array() // TODO: Review this validation
    .of(
      Yup.object({
        integrationKey: Yup.string().required('Required'),
        severity: Yup.string()
          .oneOf(['critical', 'error', 'warning', 'info'])
          .required('Required'),
        class: Yup.string().required('Required'),
        component: Yup.string().required('Required'),
        group: Yup.string().required('Required'),
      }),
    )
    .nullable(),
  slack: Yup.array() // TODO: Review this validation
    .of(
      Yup.object({
        recipient: Yup.string().required('Recipient is required'),
        token: Yup.string().required('Token is required'),
        username: Yup.string().required('Username is required'),
        iconEmoji: Yup.string(),
        iconURL: Yup.string().url('Invalid icon URL'),
        mentionUsers: Yup.array().of(Yup.string()),
        mentionGroups: Yup.array().of(Yup.string()),
        mentionChannel: Yup.string(),
        url: Yup.string().url('Invalid Slack webhook URL'),
        endpointURL: Yup.string().url('Invalid endpoint URL'),
      }),
    )
    .nullable(),
  webhook: Yup.array()
    .of(
      Yup.object({
        url: Yup.string()
          .url('Invalid webhook URL')
          .required('URL is required'),
        httpMethod: Yup.string()
          .oneOf(['POST', 'PUT'], 'Invalid HTTP method')
          .required('HTTP method is required'),
        username: Yup.string(),
        password: Yup.string(),
        authorizationScheme: Yup.string(),
        authorizationCredentials: Yup.string(),
        maxAlerts: Yup.number()
          .min(0, 'Max alerts must be greater than 0')
          .integer('Max alerts must be an integer'),
      }),
    )
    .nullable(),
});

export type ContactPointsFormValues = Yup.InferType<typeof validationSchema>;

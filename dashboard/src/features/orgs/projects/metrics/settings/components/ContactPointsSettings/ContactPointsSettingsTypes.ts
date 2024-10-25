import { EventSeverity } from '@/features/orgs/projects/metrics/settings/components/PagerdutyFormSection/PagerdutyFormSectionTypes';
import { HttpMethod } from '@/features/orgs/projects/metrics/settings/components/WebhookFormSection/WebhookFormSectionTypes';
import * as Yup from 'yup';

export const validationSchema = Yup.object({
  emails: Yup.array()
    .of(
      Yup.object({
        email: Yup.string().email('Invalid email address').required(),
      }),
    )
    .nullable(),
  discord: Yup.array()
    .of(
      Yup.object({
        url: Yup.string()
          .url('Invalid Discord URL')
          .required('Discord webhook URL is required'),
        avatarUrl: Yup.string().url('Invalid avatar URL'),
      }),
    )
    .nullable(),
  pagerduty: Yup.array()
    .of(
      Yup.object({
        integrationKey: Yup.string().required(
          'PagerDuty integration key is required',
        ),
        severity: Yup.string()
          .oneOf(Object.values(EventSeverity))
          .required('PagerDuty severity is required'),
        class: Yup.string(),
        component: Yup.string(),
        group: Yup.string(),
      }),
    )
    .nullable(),
  slack: Yup.array()
    .of(
      Yup.object({
        recipient: Yup.string(),
        token: Yup.string(),
        username: Yup.string(),
        iconEmoji: Yup.string(),
        iconURL: Yup.string().url('Invalid icon URL'),
        mentionUsers: Yup.string(),
        mentionGroups: Yup.string(),
        mentionChannel: Yup.string(),
        url: Yup.string().url('Invalid Slack webhook URL'),
        endpointURL: Yup.string().url('Invalid endpoint URL'),
      }),
    )
    .test(
      'either-url-or-recipient-token',
      'Either URL or both recipient and token must be provided',
      (value) => {
        if (!value) {
          return true;
        }
        const result = value.every(
          (item) => item.url || (item.recipient && item.token),
        );
        if (result) {
          return true;
        }
        return false;
      },
    )
    .nullable(),
  webhook: Yup.array()
    .of(
      Yup.object({
        url: Yup.string()
          .url('Invalid webhook URL')
          .required('URL is required'),
        httpMethod: Yup.string()
          .oneOf(Object.values(HttpMethod), 'Invalid HTTP method')
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

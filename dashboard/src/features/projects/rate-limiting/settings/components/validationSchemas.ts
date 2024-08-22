import * as Yup from 'yup';

export const rateLimitingItemValidationSchema = Yup.object({
  limit: Yup.number()
    .required('Limit is required.')
    .min(1)
    .positive('Limit must be a positive number')
    .typeError('Limit must be a number.'),
  interval: Yup.number()
    .required('Interval is required.')
    .min(1)
    .positive('Interval must be a positive number')
    .typeError('Interval must be a number.'),
  intervalUnit: Yup.string()
    .required('Interval unit is required.')
    .oneOf(['s', 'm', 'h']),
});

export const intervalUnitOptions = [
  { value: 's', label: 'seconds' },
  { value: 'm', label: 'minutes' },
  { value: 'h', label: 'hours' },
];

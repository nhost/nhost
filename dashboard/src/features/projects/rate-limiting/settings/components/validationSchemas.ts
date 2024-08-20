import * as Yup from 'yup';

export const rateLimitingItemValidationSchema = Yup.object({
  limit: Yup.number()
    .required('Limit is required.')
    .min(1)
    .typeError('Limit must be a number.'),
  interval: Yup.number()
    .required('Interval is required.')
    .min(1)
    .typeError('Interval must be a number.'),
  intervalUnit: Yup.string()
    .required('Interval unit is required.')
    .oneOf(['s', 'm', 'h']),
});

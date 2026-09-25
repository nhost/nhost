import * as Yup from 'yup';

import {
  baseValidationSchema,
  filterValidationSchema,
} from '@/features/orgs/projects/common/utils/permissions/validationSchemas/basePermissionValidationSchema';

const validationSchema = baseValidationSchema.shape({
  rowCheckType: Yup.string().oneOf(['none', 'custom']).required(),
  filter: Yup.mixed().when('rowCheckType', {
    is: 'custom',
    // biome-ignore lint/suspicious/noThenProperty: Yup API requires 'then' property
    then: () => filterValidationSchema,
    otherwise: () => Yup.mixed().nullable().strip(),
  }),
});

export default validationSchema;

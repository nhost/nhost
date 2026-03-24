import * as Yup from 'yup';

import {
  baseValidationSchema,
  filterValidationSchema,
} from '@/features/orgs/projects/common/utils/permissions/validationSchemas/basePermissionValidationSchema';

import type { StorageAction } from './types';

const storageBaseValidationSchema = baseValidationSchema.shape({
  rowCheckType: Yup.string().oneOf(['none', 'custom']).required(),
  filter: Yup.mixed().when('rowCheckType', {
    is: 'custom',
    then: () => filterValidationSchema,
    otherwise: () => Yup.mixed().nullable().strip(),
  }),
});

const downloadValidationSchema = storageBaseValidationSchema;

const uploadValidationSchema = storageBaseValidationSchema.shape({
  prefillUploadedByUserId: Yup.boolean().nullable(),
});

const replaceValidationSchema = storageBaseValidationSchema.shape({
  prefillUploadedByUserId: Yup.boolean().nullable(),
});

const deleteValidationSchema = storageBaseValidationSchema;

// biome-ignore lint/suspicious/noExplicitAny: Yup schema generic
const storageValidationSchemas: Record<StorageAction, Yup.ObjectSchema<any>> = {
  download: downloadValidationSchema,
  upload: uploadValidationSchema,
  replace: replaceValidationSchema,
  delete: deleteValidationSchema,
};

export default storageValidationSchemas;

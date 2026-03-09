import { z } from 'zod';

export const bucketFormSchema = z
  .object({
    name: z.string().min(1, 'Bucket name is required'),
    minUploadFileSize: z.coerce.number().int().min(1, 'Must be at least 1'),
    maxUploadFileSize: z.coerce.number().int().min(1, 'Must be at least 1'),
    presignedUrlsEnabled: z.boolean(),
    downloadExpiration: z.coerce.number().int().min(1, 'Must be at least 1'),
    cacheControl: z.string().optional(),
  })
  .refine((data) => data.maxUploadFileSize >= data.minUploadFileSize, {
    message: 'Must be greater than or equal to min upload file size',
    path: ['maxUploadFileSize'],
  });

export type BucketFormValues = z.infer<typeof bucketFormSchema>;

export const defaultBucketFormValues: BucketFormValues = {
  name: '',
  minUploadFileSize: 1,
  maxUploadFileSize: 50000000,
  presignedUrlsEnabled: true,
  downloadExpiration: 30,
  cacheControl: 'max-age=3600',
};

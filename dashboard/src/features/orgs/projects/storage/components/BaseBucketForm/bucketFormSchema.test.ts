import { bucketFormSchema, defaultBucketFormValues } from './bucketFormSchema';

describe('bucketFormSchema', () => {
  it('coerces numeric form inputs while preserving the other defaults', () => {
    expect(
      bucketFormSchema.parse({
        ...defaultBucketFormValues,
        name: 'uploads',
        minUploadFileSize: '2',
        maxUploadFileSize: '100',
        downloadExpiration: '60',
      }),
    ).toEqual({
      ...defaultBucketFormValues,
      name: 'uploads',
      minUploadFileSize: 2,
      maxUploadFileSize: 100,
      downloadExpiration: 60,
    });
  });

  it('reports the upload size relationship error on the maximum size field', () => {
    const result = bucketFormSchema.safeParse({
      ...defaultBucketFormValues,
      name: 'uploads',
      minUploadFileSize: '100',
      maxUploadFileSize: '2',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual([
      expect.objectContaining({
        path: ['maxUploadFileSize'],
        message: 'Must be greater than or equal to min upload file size',
      }),
    ]);
  });
});

import {
  defaultFormValues,
  validationSchema,
} from './BaseEventTriggerFormTypes';

const validFormValues = {
  ...defaultFormValues,
  triggerName: 'on_insert',
  dataSource: 'default',
  tableName: 'todos',
  tableSchema: 'public',
  webhook: 'https://example.com/webhook',
  triggerOperations: ['insert'] as const,
};

describe('event trigger validationSchema', () => {
  it('accepts the initialized retry defaults', () => {
    expect(validationSchema.parse(validFormValues).retryConf).toEqual(
      defaultFormValues.retryConf,
    );
  });

  it('coerces numeric retry form inputs', () => {
    expect(
      validationSchema.parse({
        ...validFormValues,
        retryConf: {
          numRetries: '2',
          intervalSec: '15',
          timeoutSec: '60',
        },
      }).retryConf,
    ).toEqual({ numRetries: 2, intervalSec: 15, timeoutSec: 60 });
  });

  it('preserves the required trigger name message', () => {
    const result = validationSchema.safeParse({
      ...validFormValues,
      triggerName: undefined,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual([
      expect.objectContaining({
        path: ['triggerName'],
        message: 'Trigger name required',
      }),
    ]);
  });
});

import type { GroupNode } from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils';

import type { StoragePermissionEditorFormValues } from './types';
import storageValidationSchemas from './validationSchemas';

function validCustomFilter(): GroupNode {
  return {
    type: 'group',
    id: 'g1',
    operator: '_and',
    children: [
      {
        type: 'condition',
        id: 'c1',
        column: 'bucket_id',
        operator: '_eq',
        value: 'default',
      },
    ],
  };
}

describe('storageValidationSchemas', () => {
  describe('download', () => {
    const schema = storageValidationSchemas.download;

    it('accepts rowCheckType "none" with empty filter', async () => {
      const values: StoragePermissionEditorFormValues = {
        rowCheckType: 'none',
        filter: {},
      };
      await expect(schema.validate(values)).resolves.toBeDefined();
    });

    it('accepts rowCheckType "custom" with valid filter', async () => {
      const values: StoragePermissionEditorFormValues = {
        rowCheckType: 'custom',
        filter: validCustomFilter(),
      };
      await expect(schema.validate(values)).resolves.toBeDefined();
    });

    it('rejects invalid rowCheckType', async () => {
      const values = { rowCheckType: 'invalid', filter: {} };
      await expect(schema.validate(values)).rejects.toThrow();
    });

    it('rejects missing rowCheckType', async () => {
      const values = { filter: {} };
      await expect(schema.validate(values)).rejects.toThrow();
    });

    it('strips filter when rowCheckType is "none"', async () => {
      const values: StoragePermissionEditorFormValues = {
        rowCheckType: 'none',
        filter: validCustomFilter(),
      };
      const result = await schema.validate(values);
      expect(result.filter).toBeUndefined();
    });

    it('validates filter conditions when rowCheckType is "custom"', async () => {
      const values = {
        rowCheckType: 'custom',
        filter: {
          type: 'group',
          id: 'g1',
          operator: '_implicit',
          children: [
            {
              type: 'condition',
              id: 'c1',
              column: null,
              operator: '_eq',
              value: 'test',
            },
          ],
        },
      };
      await expect(schema.validate(values)).rejects.toThrow(
        'Please select a column',
      );
    });
  });

  describe('upload', () => {
    const schema = storageValidationSchemas.upload;

    it('accepts prefillUploadedByUserId', async () => {
      const values = {
        rowCheckType: 'none',
        filter: {},
        prefillUploadedByUserId: true,
      };
      const result = await schema.validate(values);
      expect(result.prefillUploadedByUserId).toBe(true);
    });

    it('accepts null prefillUploadedByUserId', async () => {
      const values = {
        rowCheckType: 'none',
        filter: {},
        prefillUploadedByUserId: null,
      };
      await expect(schema.validate(values)).resolves.toBeDefined();
    });

    it('accepts custom filter with prefill', async () => {
      const values = {
        rowCheckType: 'custom',
        filter: validCustomFilter(),
        prefillUploadedByUserId: true,
      };
      await expect(schema.validate(values)).resolves.toBeDefined();
    });
  });

  describe('replace', () => {
    const schema = storageValidationSchemas.replace;

    it('accepts prefillUploadedByUserId', async () => {
      const values = {
        rowCheckType: 'none',
        filter: {},
        prefillUploadedByUserId: false,
      };
      const result = await schema.validate(values);
      expect(result.prefillUploadedByUserId).toBe(false);
    });

    it('validates filter when custom', async () => {
      const values = {
        rowCheckType: 'custom',
        filter: validCustomFilter(),
        prefillUploadedByUserId: true,
      };
      await expect(schema.validate(values)).resolves.toBeDefined();
    });
  });

  describe('delete', () => {
    const schema = storageValidationSchemas.delete;

    it('accepts rowCheckType "none"', async () => {
      const values = { rowCheckType: 'none', filter: {} };
      await expect(schema.validate(values)).resolves.toBeDefined();
    });

    it('accepts rowCheckType "custom" with valid filter', async () => {
      const values = {
        rowCheckType: 'custom',
        filter: validCustomFilter(),
      };
      await expect(schema.validate(values)).resolves.toBeDefined();
    });

    it('detects serialization collision in custom filter', async () => {
      const values = {
        rowCheckType: 'custom',
        filter: {
          type: 'group',
          id: 'g1',
          operator: '_implicit',
          children: [
            {
              type: 'condition',
              id: 'c1',
              column: 'bucket_id',
              operator: '_eq',
              value: 'a',
            },
            {
              type: 'condition',
              id: 'c2',
              column: 'bucket_id',
              operator: '_eq',
              value: 'b',
            },
          ],
        },
      };
      await expect(schema.validate(values)).rejects.toThrow(
        /bucket_id.*appears more than once/,
      );
    });
  });
});

import { baseForeignKeyValidationSchema } from '@/features/orgs/projects/database/dataGrid/components/BaseForeignKeyForm';

describe('baseForeignKeyValidationSchema', () => {
  it('rejects duplicate or incomplete local column selections', async () => {
    const values = {
      referencedSchema: 'public',
      referencedTable: 'authors',
      referencedKeyId: 'authors_key',
      targetMode: 'candidate',
      updateAction: 'RESTRICT',
      deleteAction: 'RESTRICT',
      columnMappings: [
        { column: 'author_id', referencedColumn: 'id' },
        { column: 'author_id', referencedColumn: 'tenant_id' },
      ],
    };

    await expect(
      baseForeignKeyValidationSchema.validate(values),
    ).rejects.toThrow('Select distinct local columns.');
    await expect(
      baseForeignKeyValidationSchema.validate({
        ...values,
        columnMappings: [
          { column: 'author_id', referencedColumn: 'id' },
          { column: '', referencedColumn: 'tenant_id' },
        ],
      }),
    ).rejects.toThrow('This field is required.');
  });
});

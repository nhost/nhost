import type { CandidateKey } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { baseForeignKeyValidationSchema } from '@/features/orgs/projects/database/dataGrid/components/BaseForeignKeyForm/BaseForeignKeyForm';
import resolveExistingReferencedTarget from '@/features/orgs/projects/database/dataGrid/components/BaseForeignKeyForm/resolveExistingReferencedTarget';

function candidate(
  id: string,
  name: string,
  kind: CandidateKey['kind'],
  columns: string[],
): CandidateKey {
  return { id, name, kind, columns };
}

describe('baseForeignKeyValidationSchema', () => {
  it('rejects duplicate or incomplete local column selections', async () => {
    const values = {
      referencedSchema: 'public',
      referencedTable: 'authors',
      referencedKeyId: 'authors_key',
      targetMode: 'candidate',
      preserveReferencedOrder: false,
      updateAction: 'RESTRICT',
      deleteAction: 'RESTRICT',
      columnMappings: [
        { column: 'author_id', referencedColumn: 'id' },
        { column: 'author_id', referencedColumn: 'tenant_id' },
      ],
    };

    await expect(baseForeignKeyValidationSchema.validate(values)).rejects.toThrow(
      'Select distinct local columns.',
    );
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

describe('resolveExistingReferencedTarget', () => {
  it('resolves by set while preferring exact order, PK, and lexical name', () => {
    const candidates = [
      candidate('u-z', 'z_key', 'uniqueConstraint', ['b', 'a']),
      candidate('u-a', 'a_key', 'uniqueConstraint', ['b', 'a']),
      candidate('pk', 'table_pkey', 'primaryKey', ['b', 'a']),
      candidate('exact-u', 'exact_key', 'uniqueConstraint', ['a', 'b']),
    ];

    expect(resolveExistingReferencedTarget(['a', 'b'], candidates)).toEqual({
      mode: 'candidate',
      candidate: candidates[3],
    });

    expect(
      resolveExistingReferencedTarget(['b', 'a'], candidates.toReversed()),
    ).toEqual({ mode: 'candidate', candidate: candidates[2] });
  });

  it('uses a deterministic lexical tie-break independent of query order', () => {
    const aKey = candidate('a', 'a_key', 'uniqueConstraint', ['a', 'b']);
    const zKey = candidate('z', 'z_key', 'uniqueConstraint', ['a', 'b']);

    expect(resolveExistingReferencedTarget(['a', 'b'], [zKey, aKey])).toEqual({
      mode: 'candidate',
      candidate: aKey,
    });
  });

  it('returns edit-only legacy descriptions for indexes and unmatched metadata', () => {
    expect(
      resolveExistingReferencedTarget(
        ['legacy_id'],
        [candidate('i', 'legacy_idx', 'standaloneUniqueIndex', ['legacy_id'])],
      ),
    ).toEqual({
      mode: 'legacy',
      label: 'Legacy unique index legacy_idx (legacy_id)',
    });

    expect(resolveExistingReferencedTarget(['missing'], [])).toEqual({
      mode: 'legacy',
      label: 'Legacy persisted target (missing)',
    });
  });
});

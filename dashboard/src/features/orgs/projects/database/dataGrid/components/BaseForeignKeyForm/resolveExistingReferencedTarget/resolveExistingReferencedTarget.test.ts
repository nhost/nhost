import { resolveExistingReferencedTarget } from '@/features/orgs/projects/database/dataGrid/components/BaseForeignKeyForm/resolveExistingReferencedTarget';
import type { CandidateKey } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

function candidate(
  id: string,
  name: string,
  kind: CandidateKey['kind'],
  columns: string[],
): CandidateKey {
  return { id, name, kind, columns };
}

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

  it('returns edit-only unmanaged descriptions for indexes and unmatched metadata', () => {
    expect(
      resolveExistingReferencedTarget(
        ['indexed_id', 'tenant_id'],
        [
          candidate('z', 'z_idx', 'standaloneUniqueIndex', [
            'tenant_id',
            'indexed_id',
          ]),
          candidate('b', 'b_idx', 'standaloneUniqueIndex', [
            'indexed_id',
            'tenant_id',
          ]),
          candidate('a', 'a_idx', 'standaloneUniqueIndex', [
            'indexed_id',
            'tenant_id',
          ]),
        ],
      ),
    ).toEqual({
      mode: 'unmanaged',
      label: 'UNIQUE INDEX a_idx (indexed_id, tenant_id)',
    });

    expect(resolveExistingReferencedTarget(['missing'], [])).toEqual({
      mode: 'unmanaged',
      label: 'Current target (missing)',
    });
  });
});

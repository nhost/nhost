import { getFormCandidateKeys } from '@/features/orgs/projects/database/dataGrid/components/BaseTableForm/getFormCandidateKeys';
import type { DatabaseColumn } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

const columns: DatabaseColumn[] = [
  { name: 'tenant_id', formReference: 'tenant-column', type: 'uuid' },
  { name: 'id', formReference: 'id-column', type: 'uuid' },
];

describe('getFormCandidateKeys', () => {
  it('builds draft composite primary and unique keys in form order', () => {
    expect(
      getFormCandidateKeys({
        tableName: 'comments',
        columns,
        primaryKeyIndices: ['0', '1'],
        uniqueConstraints: [
          {
            id: 'comment-identity',
            name: 'comments_identity_key',
            columnReferences: ['id-column', 'tenant-column'],
          },
        ],
      }),
    ).toEqual([
      {
        id: 'form-primary-key',
        name: 'comments_pkey',
        kind: 'primaryKey',
        columns: ['tenant_id', 'id'],
      },
      {
        id: 'form-unique-comment-identity',
        name: 'comments_identity_key',
        kind: 'uniqueConstraint',
        columns: ['id', 'tenant_id'],
      },
    ]);
  });

  it('remaps complete candidates through stable references after a column rename', () => {
    expect(
      getFormCandidateKeys({
        tableName: 'comments',
        columns: [{ ...columns[0], name: 'workspace_id' }, columns[1]],
        primaryKeyIndices: ['0', '1'],
        uniqueConstraints: [
          {
            id: 'comment-identity',
            columnReferences: ['tenant-column', 'id-column'],
          },
        ],
      }).map(({ columns: candidateColumns }) => candidateColumns),
    ).toEqual([
      ['workspace_id', 'id'],
      ['workspace_id', 'id'],
    ]);
  });

  it('omits incomplete candidate keys', () => {
    expect(
      getFormCandidateKeys({
        tableName: 'comments',
        columns,
        primaryKeyIndices: ['0', '2'],
        uniqueConstraints: [
          {
            id: 'incomplete',
            columnReferences: ['tenant-column', 'missing-column'],
          },
        ],
      }),
    ).toEqual([]);
  });
});

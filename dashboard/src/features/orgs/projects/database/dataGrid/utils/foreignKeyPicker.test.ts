import type {
  DataBrowserColumnMetadata,
  ForeignKeyRelation,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { getPickerRelations } from './foreignKeyPicker';

const columns: DataBrowserColumnMetadata[] = [
  'team_id',
  'user_id',
  'reviewer_id',
].map((id) => ({
  id,
  specificType: 'integer',
  baseType: 'integer',
  displayType: 'integer',
  isArray: false,
}));
const relation: ForeignKeyRelation = {
  name: 'membership',
  columns: ['team_id', 'user_id'],
  referencedSchema: 'public',
  referencedTable: 'members',
  referencedColumns: ['team', 'user'],
  updateAction: 'NO ACTION',
  deleteAction: 'NO ACTION',
};

describe('getPickerRelations', () => {
  it('keeps complete composite links in their mapped column order', () => {
    expect(getPickerRelations(columns, [relation])).toEqual([relation]);
  });
  it('leaves all overlapping relations as manual fields', () => {
    const second = {
      ...relation,
      name: 'other',
      columns: ['user_id'],
      referencedColumns: ['id'],
    };
    expect(getPickerRelations(columns, [relation, second])).toEqual([]);
  });
  it('keeps independent links to the same table separate', () => {
    const second = {
      ...relation,
      name: 'reviewer',
      columns: ['reviewer_id'],
      referencedColumns: ['id'],
    };
    expect(getPickerRelations(columns, [relation, second])).toEqual([
      relation,
      second,
    ]);
  });
  it('rejects incomplete, generated, unwritable and malformed groups', () => {
    expect(getPickerRelations(columns.slice(1), [relation])).toEqual([]);
    expect(
      getPickerRelations(
        columns.map((column) => ({
          ...column,
          isGenerated: column.id === 'team_id',
        })),
        [relation],
      ),
    ).toEqual([]);
    expect(
      getPickerRelations(
        columns.map((column) => ({ ...column, isEditable: false })),
        [relation],
      ),
    ).toEqual([]);
    expect(
      getPickerRelations(columns, [{ ...relation, referencedColumns: ['id'] }]),
    ).toEqual([]);
  });
});

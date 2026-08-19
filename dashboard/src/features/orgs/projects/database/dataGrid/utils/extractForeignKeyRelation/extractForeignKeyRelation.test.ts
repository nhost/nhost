import { extractForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/utils/extractForeignKeyRelation';

describe('extractForeignKeyRelation', () => {
  it('extracts ordered single and composite mappings with referential actions', () => {
    expect(
      extractForeignKeyRelation(
        'orders_tenant_fkey',
        'FOREIGN KEY (tenant_id, account_id) REFERENCES auth.accounts(tenant_id, id) ON UPDATE CASCADE ON DELETE RESTRICT',
      ),
    ).toEqual({
      name: 'orders_tenant_fkey',
      columns: ['tenant_id', 'account_id'],
      referencedSchema: 'auth',
      referencedTable: 'accounts',
      referencedColumns: ['tenant_id', 'id'],
      updateAction: 'CASCADE',
      deleteAction: 'RESTRICT',
    });
  });

  it('preserves quoted commas, escaped quotes, and quoted qualified names', () => {
    expect(
      extractForeignKeyRelation(
        'quoted_fkey',
        'FOREIGN KEY ("last, first", "say ""hello""") REFERENCES "crm.schema"."contact, records"("external, id", "quote ""id""")',
      ),
    ).toEqual({
      name: 'quoted_fkey',
      columns: ['last, first', 'say "hello"'],
      referencedSchema: 'crm.schema',
      referencedTable: 'contact, records',
      referencedColumns: ['external, id', 'quote "id"'],
      updateAction: 'NO ACTION',
      deleteAction: 'NO ACTION',
    });
  });

  it('reads actions only after the referenced-column group', () => {
    expect(
      extractForeignKeyRelation(
        'quoted_action_words_fkey',
        'FOREIGN KEY ("local ON DELETE CASCADE") REFERENCES "schema ON UPDATE RESTRICT"."table ON DELETE NO ACTION"("remote ON UPDATE NO ACTION") ON UPDATE SET NULL ON DELETE SET DEFAULT',
      ),
    ).toEqual({
      name: 'quoted_action_words_fkey',
      columns: ['local ON DELETE CASCADE'],
      referencedSchema: 'schema ON UPDATE RESTRICT',
      referencedTable: 'table ON DELETE NO ACTION',
      referencedColumns: ['remote ON UPDATE NO ACTION'],
      updateAction: 'SET NULL',
      deleteAction: 'SET DEFAULT',
    });
  });

  it('ignores action-like text inside quoted identifiers', () => {
    expect(
      extractForeignKeyRelation(
        'quoted_decoy_actions_fkey',
        'FOREIGN KEY ("local ON UPDATE INVALID") REFERENCES "table ON DELETE INVALID"("remote ON DELETE INVALID")',
      ),
    ).toMatchObject({
      columns: ['local ON UPDATE INVALID'],
      referencedTable: 'table ON DELETE INVALID',
      referencedColumns: ['remote ON DELETE INVALID'],
      updateAction: 'NO ACTION',
      deleteAction: 'NO ACTION',
    });
  });

  it('uses a null schema for same-schema references', () => {
    expect(
      extractForeignKeyRelation(
        'user_fkey',
        'FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL',
      ),
    ).toMatchObject({
      columns: ['user_id'],
      referencedSchema: null,
      referencedTable: 'users',
      referencedColumns: ['id'],
      updateAction: 'NO ACTION',
      deleteAction: 'SET NULL',
    });
  });

  it.each([
    ['', 'FOREIGN KEY (a) REFERENCES parent(id)'],
    ['missing_match', 'not a foreign key'],
    ['empty_local', 'FOREIGN KEY () REFERENCES parent(id)'],
    ['empty_local_member', 'FOREIGN KEY (a, ) REFERENCES parent(id, other)'],
    ['empty_remote', 'FOREIGN KEY (a) REFERENCES parent()'],
    ['empty_table', 'FOREIGN KEY (a) REFERENCES (id)'],
    ['unequal', 'FOREIGN KEY (a, b) REFERENCES parent(id)'],
    ['duplicate_local', 'FOREIGN KEY (a, a) REFERENCES parent(id, other)'],
    ['duplicate_remote', 'FOREIGN KEY (a, b) REFERENCES parent(id, id)'],
    ['broken_quote', 'FOREIGN KEY ("a) REFERENCES parent(id)'],
    ['too_many_table_parts', 'FOREIGN KEY (a) REFERENCES a.b.c(id)'],
    [
      'invalid_update_after_quoted_decoy',
      'FOREIGN KEY ("local ON UPDATE CASCADE") REFERENCES parent(id) ON UPDATE INVALID',
    ],
    [
      'invalid_delete_after_quoted_decoy',
      'FOREIGN KEY (a) REFERENCES parent("remote ON DELETE CASCADE") ON DELETE INVALID',
    ],
  ])('rejects malformed or ambiguous mapping %s', (name, definition) => {
    expect(extractForeignKeyRelation(name, definition)).toBeNull();
  });
});

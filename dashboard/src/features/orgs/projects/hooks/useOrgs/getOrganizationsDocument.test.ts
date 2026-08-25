import { type DocumentNode, visit } from 'graphql';
import {
  GetOrganizationsDocument,
  GetProjectDocument,
} from '@/generated/graphql';

function getSelectedFields(document: DocumentNode): string[] {
  const selectedFields: string[] = [];

  visit(document, {
    Field(node) {
      selectedFields.push(node.name.value);
    },
  });

  return selectedFields;
}

describe('organization project documents', () => {
  it('does not select project configs in the organization query', () => {
    expect(getSelectedFields(GetOrganizationsDocument)).not.toContain('config');
  });

  it('selects the config for the current project', () => {
    expect(getSelectedFields(GetProjectDocument)).toContain('config');
  });
});

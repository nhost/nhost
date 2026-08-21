import { type DocumentNode, visit } from 'graphql';
import {
  GetOrganizationDocument,
  GetOrganizationsDocument,
  GetProjectDocument,
  GetProjectsDocument,
} from '@/generated/graphql';

const organizationNavigationDocuments = [
  ['GetOrganizationDocument', GetOrganizationDocument],
  ['GetOrganizationsDocument', GetOrganizationsDocument],
  ['GetProjectsDocument', GetProjectsDocument],
] as const;

function getSelectedFields(document: DocumentNode): string[] {
  const selectedFields: string[] = [];

  visit(document, {
    Field(node) {
      selectedFields.push(node.name.value);
    },
  });

  return selectedFields;
}

describe('organization navigation documents', () => {
  it.each(
    organizationNavigationDocuments,
  )('%s does not select the project config', (_, document) => {
    // a single project with an invalid config would otherwise fail the whole
    // organization query, taking navigation down with it
    expect(getSelectedFields(document)).not.toContain('config');
  });

  it('GetProjectDocument selects the project config', () => {
    expect(getSelectedFields(GetProjectDocument)).toContain('config');
  });
});

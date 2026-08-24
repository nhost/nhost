import { hasEditorTabContent } from '@/features/orgs/projects/graphql/common/utils/hasEditorTabContent';

describe('hasEditorTabContent', () => {
  it.each(['', ' ', '\n\t'])('returns false for blank content', (content) => {
    expect(hasEditorTabContent(content)).toBe(false);
  });

  it.each([
    '{}',
    '{ }',
    '  {\n}  ',
  ])('returns false for an empty JSON object', (content) => {
    expect(hasEditorTabContent(content)).toBe(false);
  });

  it('returns true for a JSON object with keys', () => {
    expect(hasEditorTabContent('{"limit": 10}')).toBe(true);
  });

  it('returns true for non-blank invalid JSON', () => {
    expect(hasEditorTabContent('{"authorization":')).toBe(true);
  });
});

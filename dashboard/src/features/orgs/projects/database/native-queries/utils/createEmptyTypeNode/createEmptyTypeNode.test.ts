import createEmptyTypeNode from '@/features/orgs/projects/database/native-queries/utils/createEmptyTypeNode';

describe('createEmptyTypeNode', () => {
  it('creates non-nullable empty scalar nodes', () => {
    expect(createEmptyTypeNode()).toEqual({
      kind: 'scalar',
      scalar: '',
      nullable: false,
    });
  });
});

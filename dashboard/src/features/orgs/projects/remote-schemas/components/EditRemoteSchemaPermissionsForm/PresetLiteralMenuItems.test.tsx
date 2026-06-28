import { buildSchema, type GraphQLArgument } from 'graphql';
import { vi } from 'vitest';
import {
  DropdownMenu,
  DropdownMenuContent,
} from '@/components/ui/v3/dropdown-menu';
import { mockMatchMediaValue } from '@/tests/mocks';
import { render, screen } from '@/tests/testUtils';
import PresetLiteralMenuItems from './PresetLiteralMenuItems';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

const schema = buildSchema(`
  enum Role {
    ADMIN
    USER
  }
  scalar UUID
  input WhereInput {
    eq: String
  }
  type Query {
    test(
      flag: Boolean
      flagRequired: Boolean!
      count: Int
      countRequired: Int!
      pi: Float
      name: String
      nameRequired: String!
      id: ID
      idRequired: ID!
      role: Role
      roleRequired: Role!
      uid: UUID
      uidRequired: UUID!
      tags: [String!]
      tagsRequired: [String!]!
      ints: [Int]
      bools: [Boolean!]!
      enums: [Role!]
      where: WhereInput
      whereRequired: WhereInput!
    ): String
  }
`);

function arg(name: string): GraphQLArgument {
  const queryType = schema.getQueryType();
  const field = queryType?.getFields().test;
  const found = field?.args.find((a) => a.name === name);
  if (!found) {
    throw new Error(`Could not find arg ${name} in test schema`);
  }
  return found;
}

interface RenderOptions {
  sessionVariableOptions?: string[];
  isPresetSet?: boolean;
}

function renderMenuFor(argName: string, options: RenderOptions = {}) {
  return render(
    <DropdownMenu open>
      <DropdownMenuContent>
        <PresetLiteralMenuItems
          arg={arg(argName)}
          sessionVariableOptions={
            options.sessionVariableOptions ?? ['X-Hasura-User-Id']
          }
          isPresetSet={options.isPresetSet ?? false}
          onValueChange={vi.fn()}
        />
      </DropdownMenuContent>
    </DropdownMenu>,
  );
}

describe('null menu item', () => {
  it.each([
    ['flag'],
    ['count'],
    ['name'],
    ['uid'],
    ['tags'],
    ['ints'],
  ])('shows for nullable arg %s', (name) => {
    renderMenuFor(name);
    expect(screen.getByRole('menuitem', { name: 'null' })).toBeInTheDocument();
  });

  it.each([
    ['flagRequired'],
    ['nameRequired'],
    ['idRequired'],
    ['roleRequired'],
    ['tagsRequired'],
    ['whereRequired'],
  ])('hides for NonNull-wrapped arg %s', (name) => {
    renderMenuFor(name);
    expect(
      screen.queryByRole('menuitem', { name: 'null' }),
    ).not.toBeInTheDocument();
  });
});

describe('true / false menu items', () => {
  it.each([['flag'], ['flagRequired']])('shows for arg %s', (name) => {
    renderMenuFor(name);
    expect(screen.getByRole('menuitem', { name: 'true' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'false' })).toBeInTheDocument();
  });

  it.each([
    ['count'],
    ['name'],
    ['uid'],
    ['role'],
  ])('hides for non-Boolean arg %s', (name) => {
    renderMenuFor(name);
    expect(
      screen.queryByRole('menuitem', { name: 'true' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: 'false' }),
    ).not.toBeInTheDocument();
  });

  it('hides for list-of-Boolean (cannot emit bare true/false on a list arg)', () => {
    renderMenuFor('bools');
    expect(
      screen.queryByRole('menuitem', { name: 'true' }),
    ).not.toBeInTheDocument();
  });
});

describe('enum values submenu', () => {
  it.each([['role'], ['roleRequired']])('shows for enum arg %s', (name) => {
    renderMenuFor(name);
    expect(
      screen.getByRole('menuitem', { name: /Enum values/ }),
    ).toBeInTheDocument();
  });

  it('hides for list-of-enum (cannot emit bare enum value on a list arg)', () => {
    renderMenuFor('enums');
    expect(
      screen.queryByRole('menuitem', { name: /Enum values/ }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ['flag'],
    ['count'],
    ['name'],
    ['uid'],
  ])('hides for non-enum arg %s', (name) => {
    renderMenuFor(name);
    expect(
      screen.queryByRole('menuitem', { name: /Enum values/ }),
    ).not.toBeInTheDocument();
  });
});

describe('empty string menu item', () => {
  it.each([
    ['name'],
    ['nameRequired'],
    ['id'],
    ['uid'],
  ])('shows for string-like scalar arg %s', (name) => {
    renderMenuFor(name);
    expect(
      screen.getByRole('menuitem', { name: /empty string/ }),
    ).toBeInTheDocument();
  });

  it.each([
    ['flag'],
    ['count'],
    ['pi'],
    ['role'],
  ])('hides for Boolean / Int / Float / Enum arg %s', (name) => {
    renderMenuFor(name);
    expect(
      screen.queryByRole('menuitem', { name: /empty string/ }),
    ).not.toBeInTheDocument();
  });

  it.each([['tags'], ['ints']])('hides for list arg %s', (name) => {
    renderMenuFor(name);
    expect(
      screen.queryByRole('menuitem', { name: /empty string/ }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ['where'],
    ['whereRequired'],
  ])('hides for input-object arg %s (cannot emit "" on an input-object arg)', (name) => {
    renderMenuFor(name);
    expect(
      screen.queryByRole('menuitem', { name: /empty string/ }),
    ).not.toBeInTheDocument();
  });
});

describe('permission variables submenu', () => {
  it.each([
    ['flag'],
    ['count'],
    ['pi'],
    ['name'],
    ['id'],
    ['role'],
    ['uid'],
    ['uidRequired'],
  ])('shows for built-in / custom scalar / enum arg %s', (name) => {
    renderMenuFor(name);
    expect(
      screen.getByRole('menuitem', { name: /Permission variables/ }),
    ).toBeInTheDocument();
  });

  it.each([
    ['tags'],
    ['enums'],
    ['bools'],
  ])('hides for list arg %s (preset directive on a list cannot take a bare session-variable string)', (name) => {
    renderMenuFor(name);
    expect(
      screen.queryByRole('menuitem', { name: /Permission variables/ }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ['where'],
    ['whereRequired'],
  ])('hides for input-object arg %s', (name) => {
    renderMenuFor(name);
    expect(
      screen.queryByRole('menuitem', { name: /Permission variables/ }),
    ).not.toBeInTheDocument();
  });

  it('hides when sessionVariableOptions is empty even on a capable arg', () => {
    renderMenuFor('name', { sessionVariableOptions: [] });
    expect(
      screen.queryByRole('menuitem', { name: /Permission variables/ }),
    ).not.toBeInTheDocument();
  });
});

describe('Clear preset menu item', () => {
  it('shows when isPresetSet is true', () => {
    renderMenuFor('name', { isPresetSet: true });
    expect(
      screen.getByRole('menuitem', { name: /Clear preset/ }),
    ).toBeInTheDocument();
  });

  it('hides when isPresetSet is false', () => {
    renderMenuFor('name', { isPresetSet: false });
    expect(
      screen.queryByRole('menuitem', { name: /Clear preset/ }),
    ).not.toBeInTheDocument();
  });
});

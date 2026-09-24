import { RelationshipFormDialog } from '@/features/orgs/projects/database/native-queries/components/RelationshipFormDialog';
import { mockMatchMediaValue } from '@/tests/mocks';
import { render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';
import type {
  LogicalModelItem,
  NativeQueryItem,
  NativeQueryRelationship,
} from '@/utils/hasura-api/generated/schemas';

const relationship = {
  name: 'manager',
  using: {
    column_mapping: { id: 'id' },
    insertion_order: 'after_parent' as const,
    remote_native_query: 'authors',
  },
};
const arrayRelationship = {
  name: 'team_members',
  using: {
    column_mapping: { id: 'manager_id' },
    insertion_order: 'after_parent' as const,
    remote_native_query: 'authors',
  },
};
const query: NativeQueryItem = {
  root_field_name: 'authors',
  type: 'query',
  arguments: {
    id: {
      type: 'uuid',
      nullable: false,
      description: '  Identifier argument  ',
    },
  },
  code: 'SELECT id FROM authors',
  returns: 'author_model',
  description: '  Relationship-safe query  ',
  object_relationships: [relationship],
  array_relationships: [arrayRelationship],
};
const model: LogicalModelItem = {
  name: 'author_model',
  fields: [{ name: 'id', type: { scalar: 'uuid', nullable: false } }],
};
const formProps = {
  onOpenChange: vi.fn(),
  query,
  queries: [query],
  models: [model],
  onSubmit: vi.fn(),
};

async function chooseOption(
  user: TestUserEvent,
  comboboxName: string,
  optionName: string,
) {
  await user.click(screen.getByRole('combobox', { name: comboboxName }));
  await user.click(await screen.findByRole('option', { name: optionName }));
}

async function fillRequiredRelationshipFields(user: TestUserEvent) {
  await chooseOption(user, 'Target Native Query', 'authors');
  await user.click(screen.getByRole('button', { name: 'Add New Mapping' }));
}

describe('RelationshipFormDialog', () => {
  beforeAll(() => {
    window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn(() => false);
    Element.prototype.releasePointerCapture = vi.fn();
    Element.prototype.setPointerCapture = vi.fn();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('derives field options from the source and target logical models', async () => {
    const user = new TestUserEvent();
    const targetQuery: NativeQueryItem = {
      ...query,
      root_field_name: 'books',
      returns: 'book_model',
    };
    const targetModel: LogicalModelItem = {
      name: 'book_model',
      fields: [{ name: 'title', type: { scalar: 'text', nullable: false } }],
    };

    render(
      <RelationshipFormDialog
        {...formProps}
        open
        queries={[query, targetQuery]}
        models={[model, targetModel]}
      />,
    );

    await chooseOption(user, 'Target Native Query', 'books');
    await user.click(screen.getByRole('button', { name: 'Add New Mapping' }));
    expect(
      screen.getByRole('combobox', { name: 'Source field 1' }),
    ).toHaveTextContent('id');
    await user.click(screen.getByRole('combobox', { name: 'Target field 1' }));
    expect(screen.getByRole('option', { name: 'title' })).toBeInTheDocument();
  });

  it.each(['relationship', 'relationship2', '_relationship'])(
    'submits the valid relationship name %j byte-for-byte unchanged',
    async (name) => {
      const user = new TestUserEvent();
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      render(
        <RelationshipFormDialog {...formProps} open onSubmit={onSubmit} />,
      );

      await user.clear(screen.getByLabelText('Relationship Name'));
      await user.type(screen.getByLabelText('Relationship Name'), name);
      await fillRequiredRelationshipFields(user);
      await user.click(
        screen.getByRole('button', { name: 'Create Relationship' }),
      );

      await waitFor(() =>
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ name }),
        ),
      );
    },
  );

  it('blocks an empty relationship name with the shared message', async () => {
    const user = new TestUserEvent();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<RelationshipFormDialog {...formProps} open onSubmit={onSubmit} />);

    await user.clear(screen.getByLabelText('Relationship Name'));
    await fillRequiredRelationshipFields(user);
    await user.click(
      screen.getByRole('button', { name: 'Create Relationship' }),
    );

    expect(
      await screen.findByText('Relationship name is required.'),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each([
    [' ', 'Relationship name must start with a letter or underscore.'],
    [
      ' relationship',
      'Relationship name must start with a letter or underscore.',
    ],
    [
      'relationship ',
      'Relationship name must contain only letters, numbers, or underscores.',
    ],
    [
      'relationship-name!',
      'Relationship name must contain only letters, numbers, or underscores.',
    ],
    [
      '2relationship',
      'Relationship name must start with a letter or underscore.',
    ],
  ])(
    'blocks invalid relationship name %j with the shared message',
    async (name, message) => {
      const user = new TestUserEvent();
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      render(
        <RelationshipFormDialog {...formProps} open onSubmit={onSubmit} />,
      );

      await user.clear(screen.getByLabelText('Relationship Name'));
      await user.type(screen.getByLabelText('Relationship Name'), name);
      await fillRequiredRelationshipFields(user);
      await user.click(
        screen.getByRole('button', { name: 'Create Relationship' }),
      );

      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    },
  );

  it('preserves duplicate validation and exempts the original name in edit mode', async () => {
    const user = new TestUserEvent();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const view = render(
      <RelationshipFormDialog {...formProps} open onSubmit={onSubmit} />,
    );
    await user.clear(screen.getByLabelText('Relationship Name'));
    await user.type(
      screen.getByLabelText('Relationship Name'),
      arrayRelationship.name,
    );
    await fillRequiredRelationshipFields(user);
    await user.click(
      screen.getByRole('button', { name: 'Create Relationship' }),
    );

    expect(
      await screen.findByText('A relationship with this name already exists.'),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    view.unmount();
    render(
      <RelationshipFormDialog
        {...formProps}
        open
        relationship={{ relationship, kind: 'object' }}
        onSubmit={onSubmit}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ name: relationship.name }),
      ),
    );
  });

  describe.each([
    { kind: 'object', relationshipsKey: 'object_relationships' },
    { kind: 'array', relationshipsKey: 'array_relationships' },
  ] as const)('editing an $kind relationship', ({ kind, relationshipsKey }) => {
    it.each([
      { label: 'omitted', storedInsertionOrder: {}, expected: null },
      {
        label: 'null',
        storedInsertionOrder: { insertion_order: null },
        expected: null,
      },
      {
        label: 'before_parent',
        storedInsertionOrder: { insertion_order: 'before_parent' },
        expected: 'before_parent',
      },
      {
        label: 'after_parent',
        storedInsertionOrder: { insertion_order: 'after_parent' },
        expected: 'after_parent',
      },
    ] as const)(
      'submits insertion order $label with the omission default',
      async ({ storedInsertionOrder, expected }) => {
        const user = new TestUserEvent();
        const onSubmit = vi.fn().mockResolvedValue(undefined);
        const originalRelationship = {
          name: 'manager',
          using: {
            column_mapping: { id: 'id' },
            remote_native_query: 'authors',
            ...storedInsertionOrder,
          },
        } satisfies NativeQueryRelationship;
        const originalQuery: NativeQueryItem = {
          ...query,
          object_relationships: [],
          array_relationships: [],
          [relationshipsKey]: [originalRelationship],
        };
        render(
          <RelationshipFormDialog
            {...formProps}
            open
            query={originalQuery}
            queries={[originalQuery]}
            relationship={{ relationship: originalRelationship, kind }}
            onSubmit={onSubmit}
          />,
        );
        await user.click(screen.getByRole('button', { name: 'Save Changes' }));

        await waitFor(() =>
          expect(onSubmit).toHaveBeenCalledWith({
            name: 'manager',
            kind,
            remoteNativeQuery: 'authors',
            fieldMappings: [{ sourceField: 'id', targetField: 'id' }],
            insertionOrder: expected,
          }),
        );
      },
    );
  });

  it('guards dirty drafts and resets whenever the dialog reopens', async () => {
    const user = new TestUserEvent();
    const view = render(<RelationshipFormDialog {...formProps} open />);
    await user.clear(screen.getByLabelText('Relationship Name'));
    await user.type(screen.getByLabelText('Relationship Name'), 'draft');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(formProps.onOpenChange).not.toHaveBeenCalled();
    expect(
      screen.getByRole('heading', { name: 'Unsaved changes' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(formProps.onOpenChange).toHaveBeenCalledWith(false);
    view.rerender(<RelationshipFormDialog {...formProps} open={false} />);
    view.rerender(<RelationshipFormDialog {...formProps} open />);

    await waitFor(() =>
      expect(screen.getByLabelText('Relationship Name')).toHaveValue(''),
    );
    expect(
      screen.getByRole('combobox', { name: 'Target Native Query' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(formProps.onOpenChange).toHaveBeenCalledTimes(2);
    expect(formProps.onOpenChange).toHaveBeenLastCalledWith(false);
  });
});

import { RelationshipFormDialog } from '@/features/orgs/projects/database/native-queries/components/RelationshipFormDialog';
import { mockMatchMediaValue } from '@/tests/mocks';
import { fireEvent, render, screen, waitFor } from '@/tests/testUtils';
import type {
  LogicalModelItem,
  NativeQueryItem,
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
  comment: '  Relationship-safe query  ',
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

const chooseOption = (comboboxName: string, optionName: string) => {
  fireEvent.keyDown(screen.getByRole('combobox', { name: comboboxName }), {
    key: 'Enter',
  });
  fireEvent.click(screen.getByRole('option', { name: optionName }));
};

const fillRequiredRelationshipFields = () => {
  chooseOption('Target Native Query', 'authors');
  fireEvent.click(screen.getByRole('button', { name: 'Add New Mapping' }));
};

describe('RelationshipFormDialog', () => {
  beforeAll(() => {
    window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('derives field options from the source and target logical models', () => {
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

    chooseOption('Target Native Query', 'books');
    fireEvent.click(screen.getByRole('button', { name: 'Add New Mapping' }));
    expect(screen.getByTestId('fieldMappings.0.sourceField')).toHaveTextContent(
      'id',
    );
    fireEvent.keyDown(screen.getByTestId('fieldMappings.0.targetField'), {
      key: 'Enter',
    });
    expect(screen.getByRole('option', { name: 'title' })).toBeInTheDocument();
  });

  it.each([
    'relationship',
    'relationship2',
    '_relationship',
  ])('submits the valid relationship name %j byte-for-byte unchanged', async (name) => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<RelationshipFormDialog {...formProps} open onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Relationship Name'), {
      target: { value: name },
    });
    fillRequiredRelationshipFields();
    fireEvent.submit(
      screen
        .getByRole('button', { name: 'Create Relationship' })
        .closest('form')!,
    );

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name })),
    );
  });

  it.each([
    ['', 'Relationship name is required.'],
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
  ])('blocks invalid relationship name %j with the shared message', async (name, message) => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<RelationshipFormDialog {...formProps} open onSubmit={onSubmit} />);

    if (name) {
      fireEvent.change(screen.getByLabelText('Relationship Name'), {
        target: { value: name },
      });
    }
    fillRequiredRelationshipFields();
    fireEvent.submit(
      screen
        .getByRole('button', { name: 'Create Relationship' })
        .closest('form')!,
    );

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('preserves duplicate validation and exempts the original name in edit mode', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const view = render(
      <RelationshipFormDialog {...formProps} open onSubmit={onSubmit} />,
    );
    fireEvent.change(screen.getByLabelText('Relationship Name'), {
      target: { value: arrayRelationship.name },
    });
    fillRequiredRelationshipFields();
    fireEvent.submit(
      screen
        .getByRole('button', { name: 'Create Relationship' })
        .closest('form')!,
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
    fireEvent.submit(
      screen.getByRole('button', { name: 'Save Changes' }).closest('form')!,
    );

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ name: relationship.name }),
      ),
    );
  });

  it('guards dirty drafts and resets whenever the dialog reopens', async () => {
    const view = render(<RelationshipFormDialog {...formProps} open />);
    fireEvent.change(screen.getByLabelText('Relationship Name'), {
      target: { value: 'draft' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(formProps.onOpenChange).not.toHaveBeenCalled();
    expect(
      screen.getByRole('heading', { name: 'Unsaved changes' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(formProps.onOpenChange).toHaveBeenCalledWith(false);
    view.rerender(<RelationshipFormDialog {...formProps} open={false} />);
    view.rerender(<RelationshipFormDialog {...formProps} open />);

    await waitFor(() =>
      expect(screen.getByLabelText('Relationship Name')).toHaveValue(''),
    );
    expect(
      screen.getByRole('combobox', { name: 'Target Native Query' }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(formProps.onOpenChange).toHaveBeenCalledTimes(2);
    expect(formProps.onOpenChange).toHaveBeenLastCalledWith(false);
  });
});

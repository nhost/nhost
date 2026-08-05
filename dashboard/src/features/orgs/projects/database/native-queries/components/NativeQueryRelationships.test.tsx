import { act } from 'react';
import { toast } from 'react-hot-toast';
import { vi } from 'vitest';
import { useDialog } from '@/components/common/DialogProvider';
import NativeQueryRelationships, {
  RelationshipFormDialog,
} from '@/features/orgs/projects/database/native-queries/components/NativeQueryRelationships';
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
const trackedQuery = {
  ...query,
  source: 'default',
  arguments: {
    id: {
      type: 'uuid',
      nullable: false,
      description: 'Identifier argument',
    },
  },
  comment: 'Relationship-safe query',
};
const model: LogicalModelItem = {
  name: 'author_model',
  fields: [{ name: 'id', type: { scalar: 'uuid', nullable: false } }],
};
const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  reset: vi.fn(),
}));

vi.mock(
  '@/features/orgs/projects/database/native-queries/hooks/useNativeQueryMetadataMutation',
  () => ({
    default: () => ({
      mutateAsync: mocks.mutateAsync,
      reset: mocks.reset,
      isPending: false,
    }),
  }),
);

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

const fillMapping = () => {
  chooseOption('Target Native Query', 'authors');
  fireEvent.click(screen.getByRole('button', { name: 'Add New Mapping' }));
};

function DrawerHarness() {
  const { openDrawer } = useDialog();
  return (
    <button
      type="button"
      onClick={() =>
        openDrawer({
          title: 'Edit Relationships',
          component: (
            <NativeQueryRelationships
              query={query}
              queries={[query]}
              models={[model]}
            />
          ),
        })
      }
    >
      Open relationships drawer
    </button>
  );
}

const waitOutDrawerTransition = () =>
  act(
    () =>
      new Promise((resolve) => {
        setTimeout(resolve, 300);
      }),
  );

describe('NativeQueryRelationships', () => {
  beforeAll(() => {
    window.matchMedia = vi.fn().mockImplementation((media: string) => ({
      matches: false,
      media,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mutateAsync.mockResolvedValue({ message: 'success' });
  });

  afterEach(() => {
    act(() => toast.remove());
  });

  it('lists relationship counts and creates a self-relationship from model fields', async () => {
    render(
      <NativeQueryRelationships
        query={query}
        queries={[query]}
        models={[model]}
      />,
    );
    expect(screen.getByText('1 object · 1 array')).toBeInTheDocument();
    expect(screen.getByText('manager')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Relationship' }));
    fireEvent.change(screen.getByLabelText('Relationship Name'), {
      target: { value: 'reports' },
    });
    fillMapping();
    fireEvent.submit(
      screen
        .getByRole('button', { name: 'Create Relationship' })
        .closest('form')!,
    );

    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith({
        original: query,
        args: {
          ...trackedQuery,
          object_relationships: [
            relationship,
            {
              name: 'reports',
              using: {
                column_mapping: { id: 'id' },
                insertion_order: null,
                remote_native_query: 'authors',
              },
            },
          ],
        },
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Create Relationship' }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole('heading', { name: 'Relationships' }),
    ).toBeInTheDocument();
  });

  it('edits a relationship while retaining insertion order', async () => {
    render(
      <NativeQueryRelationships
        query={query}
        queries={[query]}
        models={[model]}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit relationship manager' }),
    );
    expect(
      screen.getByRole('combobox', { name: 'Target Native Query' }),
    ).toHaveTextContent('authors');
    fireEvent.change(screen.getByLabelText('Relationship Name'), {
      target: { value: 'lead' },
    });
    fireEvent.submit(
      screen.getByRole('button', { name: 'Save Changes' }).closest('form')!,
    );

    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith({
        original: query,
        args: {
          ...trackedQuery,
          object_relationships: [{ ...relationship, name: 'lead' }],
        },
      }),
    );
  });

  it('deletes a relationship after confirmation', async () => {
    render(
      <NativeQueryRelationships
        query={query}
        queries={[query]}
        models={[model]}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete relationship manager' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete relationship' }),
    );

    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith({
        original: query,
        args: { ...trackedQuery, object_relationships: [] },
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Delete relationship?' }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole('heading', { name: 'Relationships' }),
    ).toBeInTheDocument();
  });

  it('validates required and relationship names across both collections', async () => {
    const queryWithArrayRelationship: NativeQueryItem = {
      ...query,
      array_relationships: [
        {
          name: 'reports',
          using: {
            column_mapping: { id: 'id' },
            insertion_order: null,
            remote_native_query: 'authors',
          },
        },
      ],
    };
    render(
      <NativeQueryRelationships
        query={queryWithArrayRelationship}
        queries={[queryWithArrayRelationship]}
        models={[model]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Relationship' }));
    fireEvent.submit(
      screen
        .getByRole('button', { name: 'Create Relationship' })
        .closest('form')!,
    );
    expect(
      await screen.findByText('Relationship name is required.'),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Add at least one field mapping.'),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Relationship Name'), {
      target: { value: 'reports' },
    });
    fillMapping();
    fireEvent.submit(
      screen
        .getByRole('button', { name: 'Create Relationship' })
        .closest('form')!,
    );
    expect(
      await screen.findByText('A relationship with this name already exists.'),
    ).toBeInTheDocument();
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

  describe('inside the edit relationships drawer', () => {
    it('closes only the relationship dialog when pressing Escape', async () => {
      render(<DrawerHarness />);
      fireEvent.click(
        screen.getByRole('button', { name: 'Open relationships drawer' }),
      );
      fireEvent.click(
        await screen.findByRole('button', { name: 'Relationship' }),
      );

      fireEvent.keyDown(
        screen.getByRole('dialog', { name: 'Create Relationship' }),
        { key: 'Escape' },
      );

      await waitFor(() =>
        expect(
          screen.queryByRole('dialog', { name: 'Create Relationship' }),
        ).not.toBeInTheDocument(),
      );
      await waitOutDrawerTransition();
      expect(
        screen.getByRole('heading', { name: 'Relationships' }),
      ).toBeInTheDocument();
    });

    it('closes only the delete confirmation when pressing Escape', async () => {
      render(<DrawerHarness />);
      fireEvent.click(
        screen.getByRole('button', { name: 'Open relationships drawer' }),
      );
      fireEvent.click(
        await screen.findByRole('button', {
          name: 'Delete relationship manager',
        }),
      );

      fireEvent.keyDown(
        screen.getByRole('alertdialog', { name: 'Delete relationship?' }),
        { key: 'Escape' },
      );

      await waitFor(() =>
        expect(
          screen.queryByRole('alertdialog', { name: 'Delete relationship?' }),
        ).not.toBeInTheDocument(),
      );
      await waitOutDrawerTransition();
      expect(mocks.mutateAsync).not.toHaveBeenCalled();
      expect(
        screen.getByRole('heading', { name: 'Relationships' }),
      ).toBeInTheDocument();
    });

    it('keeps the dialog and drawer open when Escape rejects the discard confirmation', async () => {
      render(<DrawerHarness />);
      fireEvent.click(
        screen.getByRole('button', { name: 'Open relationships drawer' }),
      );
      fireEvent.click(
        await screen.findByRole('button', { name: 'Relationship' }),
      );
      fireEvent.change(screen.getByLabelText('Relationship Name'), {
        target: { value: 'draft' },
      });

      fireEvent.keyDown(
        screen.getByRole('dialog', { name: 'Create Relationship' }),
        { key: 'Escape' },
      );
      const discardDialog = await screen.findByRole('alertdialog', {
        name: 'Unsaved changes',
      });

      fireEvent.keyDown(discardDialog, { key: 'Escape' });

      await waitFor(() =>
        expect(
          screen.queryByRole('alertdialog', { name: 'Unsaved changes' }),
        ).not.toBeInTheDocument(),
      );
      await waitOutDrawerTransition();
      expect(
        screen.getByRole('dialog', { name: 'Create Relationship' }),
      ).toBeInTheDocument();
      // The open modal dialog marks the drawer aria-hidden, so query by text.
      expect(screen.getByText('Relationships')).toBeInTheDocument();
    });
  });
});

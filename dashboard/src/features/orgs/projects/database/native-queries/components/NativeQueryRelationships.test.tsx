import { act } from 'react';
import { toast } from 'react-hot-toast';
import { vi } from 'vitest';
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
  isPending: false,
  onSubmit: vi.fn(),
};

const chooseOption = (comboboxName: string, optionName: string) => {
  fireEvent.keyDown(screen.getByRole('combobox', { name: comboboxName }), {
    key: 'Enter',
  });
  fireEvent.click(screen.getByRole('option', { name: optionName }));
};

const fillMapping = () => {
  chooseOption('Target native query', 'authors');
  chooseOption('Source field 1', 'id');
  chooseOption('Target field 1', 'id');
};

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

    fireEvent.click(screen.getByRole('button', { name: 'Add relationship' }));
    fireEvent.change(screen.getByLabelText('Relationship name'), {
      target: { value: 'reports' },
    });
    fillMapping();
    fireEvent.submit(
      screen
        .getByRole('button', { name: 'Save relationship' })
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
        screen.queryByRole('heading', { name: 'Create relationship' }),
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
      screen.getByRole('combobox', { name: 'Target native query' }),
    ).toHaveTextContent('authors');
    fireEvent.change(screen.getByLabelText('Relationship name'), {
      target: { value: 'lead' },
    });
    fireEvent.submit(
      screen
        .getByRole('button', { name: 'Save relationship' })
        .closest('form')!,
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
    fireEvent.click(screen.getByRole('button', { name: 'Add relationship' }));
    fireEvent.submit(
      screen
        .getByRole('button', { name: 'Save relationship' })
        .closest('form')!,
    );
    expect(
      await screen.findByText('Relationship name is required.'),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Relationship name'), {
      target: { value: 'reports' },
    });
    fillMapping();
    fireEvent.submit(
      screen
        .getByRole('button', { name: 'Save relationship' })
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

    chooseOption('Target native query', 'books');
    chooseOption('Source field 1', 'id');
    expect(
      screen.getByRole('combobox', { name: 'Source field 1' }),
    ).toHaveTextContent('id');
    fireEvent.keyDown(
      screen.getByRole('combobox', { name: 'Target field 1' }),
      {
        key: 'Enter',
      },
    );
    expect(screen.getByRole('option', { name: 'title' })).toBeInTheDocument();
  });

  it('cancels and resets its draft whenever the dialog reopens', async () => {
    const view = render(<RelationshipFormDialog {...formProps} open />);
    fireEvent.change(screen.getByLabelText('Relationship name'), {
      target: { value: 'draft' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(formProps.onOpenChange).toHaveBeenCalledWith(false);
    view.rerender(<RelationshipFormDialog {...formProps} open={false} />);
    view.rerender(<RelationshipFormDialog {...formProps} open />);

    await waitFor(() =>
      expect(screen.getByLabelText('Relationship name')).toHaveValue(''),
    );
    expect(
      screen.getByRole('combobox', { name: 'Target native query' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Source field 1' }),
    ).toBeInTheDocument();
  });
});

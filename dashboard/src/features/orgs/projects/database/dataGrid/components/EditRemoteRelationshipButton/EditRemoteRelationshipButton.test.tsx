import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { toast } from 'react-hot-toast';
import { mockMatchMediaValue } from '@/tests/mocks';
import tableQuery from '@/tests/msw/mocks/rest/tableQuery';
import {
  mockScrollIntoViewAndPointerCapture,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import EditRemoteRelationshipButton from './EditRemoteRelationshipButton';

mockScrollIntoViewAndPointerCapture();

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

const metadataUrl = 'https://local.hasura.local.nhost.run/v1/metadata';

const server = setupServer(
  tableQuery,
  http.post(metadataUrl, async ({ request }) => {
    const { type } = (await request.json()) as { type: string };

    if (type === 'export_metadata') {
      return HttpResponse.json({
        resource_version: 70,
        metadata: {
          version: 3,
          sources: [
            {
              name: 'default',
              kind: 'postgres',
              tables: [
                { table: { schema: 'public', name: 'authors' } },
                { table: { schema: 'public', name: 'books' } },
              ],
            },
          ],
        },
      });
    }

    return HttpResponse.json(
      {
        error:
          'metadata resource version referenced (70) did not match current version',
      },
      { status: 409 },
    );
  }),
);

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  toast.remove();
});
afterAll(() => server.close());

async function openDialogAndSelectArrayRelationship(user: TestUserEvent) {
  render(
    <EditRemoteRelationshipButton
      source="default"
      schema="public"
      tableName="books"
      relationshipName="author"
      relationshipDefinition={{
        to_source: {
          source: 'default',
          table: { schema: 'public', name: 'authors' },
          relationship_type: 'object',
          field_mapping: { author_id: 'id' },
        },
      }}
    />,
  );

  await user.click(screen.getByRole('button'));
  await waitFor(() =>
    expect(screen.getByTestId('toReferenceSourceSelect')).toHaveTextContent(
      'default',
    ),
  );

  const relationshipTypeSelect = screen.getByRole('combobox', {
    name: 'Relationship Type',
  });
  await user.click(relationshipTypeSelect);
  await user.click(screen.getByRole('option', { name: 'Array Relationship' }));
  expect(relationshipTypeSelect).toHaveTextContent('Array Relationship');

  return relationshipTypeSelect;
}

test('keeps the dialog open with the edited values when saving fails', async () => {
  const user = new TestUserEvent();
  const relationshipTypeSelect =
    await openDialogAndSelectArrayRelationship(user);

  await user.click(screen.getByRole('button', { name: 'Save Changes' }));

  // The open modal marks the toaster aria-hidden, so toast queries need `hidden`.
  expect(
    await screen.findByRole('heading', {
      name: 'Metadata is out of date',
      hidden: true,
    }),
  ).toBeInTheDocument();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(relationshipTypeSelect).toHaveTextContent('Array Relationship');
});

test('closes the dialog when saving succeeds', async () => {
  server.use(
    http.post(metadataUrl, async ({ request }) => {
      const { type } = (await request.clone().json()) as { type: string };

      if (type === 'bulk') {
        return HttpResponse.json([{ message: 'success' }]);
      }

      return undefined;
    }),
  );
  const user = new TestUserEvent();
  await openDialogAndSelectArrayRelationship(user);

  await user.click(screen.getByRole('button', { name: 'Save Changes' }));

  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
});

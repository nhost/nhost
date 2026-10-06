import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { mockMatchMediaValue } from '@/tests/mocks';
import tableQuery from '@/tests/msw/mocks/rest/tableQuery';
import {
  mockScrollIntoViewAndPointerCapture,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import CreateRelationshipDialog from './CreateRelationshipDialog';

mockScrollIntoViewAndPointerCapture();

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

const server = setupServer(
  tableQuery,
  http.post(
    'https://local.hasura.local.nhost.run/v1/metadata',
    async ({ request }) => {
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
    },
  ),
);

beforeAll(() => server.listen());
afterAll(() => server.close());

test('shows the metadata conflict toast and keeps the dialog open', async () => {
  const user = new TestUserEvent();
  render(
    <CreateRelationshipDialog
      source="default"
      schema="public"
      tableName="books"
    />,
  );

  await user.click(screen.getByRole('button', { name: 'Relationship' }));
  await user.type(screen.getByPlaceholderText('Name...'), 'author');
  await user.click(screen.getByTestId('toReferenceSourceSelect'));
  await user.click(await screen.findByRole('option', { name: 'default' }));
  await user.click(screen.getByTestId('toReferenceSchemaSelect'));
  await user.click(screen.getByRole('option', { name: 'public' }));
  await user.click(screen.getByTestId('toReferenceTableCombobox'));
  await user.click(screen.getByRole('option', { name: 'authors' }));
  const addMappingButton = screen.getByRole('button', {
    name: 'Add New Mapping',
  });
  await waitFor(() => expect(addMappingButton).toBeEnabled());
  await user.click(addMappingButton);
  await user.click(screen.getByRole('button', { name: 'Create Relationship' }));

  // The open modal marks the toaster aria-hidden, so toast queries need `hidden`.
  expect(
    await screen.findByRole('heading', {
      name: 'Metadata is out of date',
      hidden: true,
    }),
  ).toBeInTheDocument();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});

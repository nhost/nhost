import { toast } from 'react-hot-toast';
import showErrorToast from '@/features/orgs/utils/execPromiseWithErrorToast/show-error-toast';
import { mockMatchMediaValue } from '@/tests/mocks';
import { render, screen } from '@/tests/testUtils';
import { MetadataVersionConflictError } from '@/utils/hasura-api/metadata-version-conflict-error';

const CONFLICT_MESSAGE =
  'metadata resource version referenced (42) did not match current version';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

afterEach(() => {
  toast.remove();
});

it('shows the shared persistent ErrorToast presentation', async () => {
  render(<div />);

  showErrorToast(
    new MetadataVersionConflictError(
      CONFLICT_MESSAGE,
      'https://hasura.example.test',
    ),
    CONFLICT_MESSAGE,
  );

  expect(await screen.findByText(CONFLICT_MESSAGE)).toBeInTheDocument();
  expect(document.querySelectorAll('.error-toast')).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Show error details' }),
  ).toBeInTheDocument();
});

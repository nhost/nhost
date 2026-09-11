import { vi } from 'vitest';
import ProjectDatabasePagesComboBox from '@/components/layout/Header/ProjectDatabasePagesComboBox';
import {
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
} from '@/tests/testUtils';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  useRouter: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

const databasePages = [
  {
    label: 'Table Editor & Browser',
    value: 'browser',
    route: 'database/browser/default',
  },
  {
    label: 'Schema Navigator',
    value: 'schema',
    route: 'database/schema/default',
  },
  {
    label: 'Native Queries',
    value: 'native-queries',
    route: 'database/native-queries/default',
  },
];

function renderDatabasePagesCombobox(databasePage: string) {
  mocks.useRouter.mockReturnValue({
    asPath: `/orgs/org-a/projects/project-a/database/${databasePage}/default`,
    push: mocks.push,
    query: {
      appSubdomain: 'project-a',
      orgSlug: 'org-a',
    },
  });

  render(<ProjectDatabasePagesComboBox />);
}

beforeEach(() => {
  mocks.push.mockReset();
  mocks.useRouter.mockReset();
  mockPointerEvent();
});

describe('ProjectDatabasePagesComboBox', () => {
  it('lists every database page option', async () => {
    renderDatabasePagesCombobox('browser');

    const user = new TestUserEvent();
    await user.click(screen.getByRole('combobox'));

    expect(
      screen.getAllByRole('option').map((option) => option.textContent),
    ).toEqual(databasePages.map(({ label }) => label));
  });

  it.each(databasePages)(
    'shows $label as selected and navigates to its route',
    async ({ label, value, route }) => {
      renderDatabasePagesCombobox(value);

      const user = new TestUserEvent();
      const combobox = screen.getByRole('combobox');
      expect(combobox).toHaveTextContent(label);

      await user.click(combobox);
      await user.click(screen.getByRole('option', { name: label }));

      expect(mocks.push).toHaveBeenCalledOnce();
      expect(mocks.push).toHaveBeenCalledWith(
        `/orgs/org-a/projects/project-a/${route}`,
      );
    },
  );
});

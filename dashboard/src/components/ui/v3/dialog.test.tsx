import { Dialog, DialogContent, DialogTitle } from '@/components/ui/v3/dialog';
import { render, screen } from '@/tests/testUtils';

function renderDialog(children: React.ReactNode) {
  render(
    <Dialog open>
      <DialogContent aria-describedby={undefined}>
        <DialogTitle>Dialog</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>,
  );
}

describe('DialogContent', () => {
  it('focuses the first text field on open', async () => {
    renderDialog(
      <>
        <input aria-label="Name" />
        <button type="button">Save</button>
      </>,
    );

    expect(await screen.findByLabelText('Name')).toHaveFocus();
  });

  it('focuses the dialog instead of a first dropdown', async () => {
    renderDialog(
      <>
        <button
          type="button"
          role="combobox"
          aria-expanded={false}
          aria-label="Organization"
        />
        <button type="button">Save</button>
      </>,
    );

    expect(await screen.findByRole('dialog')).toHaveFocus();
  });

  it('focuses a search box that has the combobox role', async () => {
    renderDialog(
      <input role="combobox" aria-expanded={false} aria-label="Search" />,
    );

    expect(await screen.findByLabelText('Search')).toHaveFocus();
  });

  it('focuses the dialog instead of a first checkbox', async () => {
    renderDialog(<input type="checkbox" aria-label="I understand" />);

    expect(await screen.findByRole('dialog')).toHaveFocus();
  });
});

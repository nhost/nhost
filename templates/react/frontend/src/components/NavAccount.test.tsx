import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import NavAccount from '@/components/NavAccount';

const render = (path: string) =>
  renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <NavAccount
        signedOutPaths={['/auth/method/finish']}
        signedIn={<span>account</span>}
        signedOut={<span>ways in</span>}
      />
    </MemoryRouter>,
  );

describe('NavAccount', () => {
  // A reset link signs the visitor in only so the new password can be saved;
  // until then the nav should not say they are signed in.
  it('looks signed out on a method page that asks for it', () => {
    for (const path of ['/auth/method/finish', '/auth/method/finish/step']) {
      expect(render(path)).toContain('ways in');
    }

    expect(render('/auth/method/finished')).toContain('account');
  });
});

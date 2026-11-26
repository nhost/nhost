import {
  readConsentCookie,
  writeConsentCookie,
} from '@/components/common/CookieConsent/consentCookie';
import withdrawCookieConsent from '@/components/common/CookieConsent/withdrawCookieConsent';
import { mockMatchMediaValue } from '@/tests/mocks';
import { render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';
import CookieSettings from './CookieSettings';

vi.mock('@/components/common/CookieConsent/withdrawCookieConsent');

// The success toast reads `prefers-reduced-motion`.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

const RELOAD_NOTICE = 'Saving reloads the page, so analytics stop running.';

function clearConsentCookie() {
  // biome-ignore lint/suspicious/noDocumentCookie: reset the saved choice between tests
  document.cookie = 'nhost-cookie-consent=; Path=/; Max-Age=0';
}

function getAllCookiesOption() {
  return screen.getByRole('radio', { name: /^All cookies/ });
}

function getEssentialOnlyOption() {
  return screen.getByRole('radio', { name: /^Essential only/ });
}

function getSaveButton() {
  return screen.getByRole('button', { name: 'Save' });
}

describe('CookieSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    clearConsentCookie();
  });

  it('shows the saved choice with nothing to save', async () => {
    writeConsentCookie(false);
    render(<CookieSettings />);

    await waitFor(() => expect(getEssentialOnlyOption()).toBeChecked());
    expect(getAllCookiesOption()).not.toBeChecked();
    expect(getSaveButton()).toBeDisabled();
  });

  it('saves a first choice', async () => {
    const user = new TestUserEvent();
    render(<CookieSettings />);

    expect(getAllCookiesOption()).not.toBeChecked();
    expect(getEssentialOnlyOption()).not.toBeChecked();
    expect(getSaveButton()).toBeDisabled();

    await user.click(getEssentialOnlyOption());
    await user.click(getSaveButton());

    expect(readConsentCookie()).toBe(false);
    expect(getSaveButton()).toBeDisabled();
    expect(withdrawCookieConsent).not.toHaveBeenCalled();
  });

  it('accepts all cookies without reloading', async () => {
    writeConsentCookie(false);
    const user = new TestUserEvent();
    render(<CookieSettings />);

    await waitFor(() => expect(getEssentialOnlyOption()).toBeChecked());
    await user.click(getAllCookiesOption());

    expect(screen.queryByText(RELOAD_NOTICE)).not.toBeInTheDocument();

    await user.click(getSaveButton());

    expect(readConsentCookie()).toBe(true);
    expect(getAllCookiesOption()).toBeChecked();
    expect(getSaveButton()).toBeDisabled();
    expect(withdrawCookieConsent).not.toHaveBeenCalled();
  });

  it('warns before withdrawing consent, then withdraws it on save', async () => {
    writeConsentCookie(true);
    const user = new TestUserEvent();
    render(<CookieSettings />);

    await waitFor(() => expect(getAllCookiesOption()).toBeChecked());
    expect(screen.queryByText(RELOAD_NOTICE)).not.toBeInTheDocument();

    await user.click(getEssentialOnlyOption());

    expect(screen.getByText(RELOAD_NOTICE)).toBeInTheDocument();

    await user.click(getSaveButton());

    expect(withdrawCookieConsent).toHaveBeenCalledTimes(1);
  });
});

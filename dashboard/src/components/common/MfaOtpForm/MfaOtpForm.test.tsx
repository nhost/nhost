import { render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MfaOtpForm from './MfaOtpForm';

const mocks = vi.hoisted(() => ({
  toastError: vi.fn(),
}));
// Mock react-hot-toast
vi.mock('react-hot-toast', async () => {
  // biome-ignore lint/suspicious/noExplicitAny: Test file
  const actualToast = await vi.importActual<any>('react-hot-toast');
  return {
    ...actualToast,
    default: {
      ...actualToast.default,
      error: mocks.toastError,
    },
  };
});

// Mock the toast style props utility
vi.mock('@/utils/constants/settings', () => ({
  getToastStyleProps: vi.fn(() => ({})),
}));

describe('MfaOtpForm', () => {
  const mockSendMfaOtp = vi.fn();
  const mockRequestNewMfaTicket = vi.fn();
  const user = new TestUserEvent();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  const defaultProps = {
    sendMfaOtp: mockSendMfaOtp,
    loading: false,
    requestNewMfaTicket: mockRequestNewMfaTicket,
    // biome-ignore lint/suspicious/noExplicitAny: Test file
  } as any;

  describe('Rendering and Initial State', () => {
    it('renders with correct initial state', () => {
      render(<MfaOtpForm {...defaultProps} />);

      const input = screen.getByPlaceholderText('Enter TOTP');
      const button = screen.getByRole('button', { name: 'Verify' });

      expect(input).toBeInTheDocument();
      expect(input).toHaveValue('');
      expect(button).toBeInTheDocument();
      expect(button).toBeDisabled();
    });

    it('focuses input on mount', () => {
      render(<MfaOtpForm {...defaultProps} />);

      const input = screen.getByPlaceholderText('Enter TOTP');
      expect(input).toHaveFocus();
    });
  });

  describe('Input Validation and Formatting', () => {
    it('only accepts numeric characters', async () => {
      render(<MfaOtpForm {...defaultProps} />);

      const input = screen.getByPlaceholderText('Enter TOTP');
      await user.type(input, 'abc123def456');

      expect(input).toHaveValue('123456');
    });

    it('filters out non-numeric characters in real time', async () => {
      render(<MfaOtpForm {...defaultProps} />);

      const input = screen.getByPlaceholderText('Enter TOTP');
      await user.type(input, '1a2b3c');

      expect(input).toHaveValue('123');
    });

    it('button is disabled when input has fewer than 6 digits', async () => {
      render(<MfaOtpForm {...defaultProps} />);

      const input = screen.getByPlaceholderText('Enter TOTP');
      const button = screen.getByRole('button', { name: 'Verify' });

      await user.type(input, '12345');
      expect(button).toBeDisabled();
    });

    it('button is enabled when input has exactly 6 digits', async () => {
      render(<MfaOtpForm {...defaultProps} />);

      const input = screen.getByPlaceholderText('Enter TOTP');
      const button = screen.getByRole('button', { name: 'Verify' });

      await user.type(input, '123456');
      expect(button).toBeEnabled();
    });

    it('button is disabled when input has more than 6 digits', async () => {
      render(<MfaOtpForm {...defaultProps} />);
      const input = screen.getByPlaceholderText('Enter TOTP');
      const button = screen.getByRole('button', { name: 'Verify' });

      await user.type(input, '6123457');
      expect(button).toBeDisabled();
    });
  });

  describe('Loading States', () => {
    it('disables input and button when loading prop is true', () => {
      render(<MfaOtpForm {...defaultProps} loading />);

      const input = screen.getByPlaceholderText('Enter TOTP');
      const button = screen.getByRole('button');

      expect(input).toBeDisabled();
      expect(button).toBeDisabled();
      expect(
        screen.getByRole('button', { name: 'Verifying...' }),
      ).toBeInTheDocument();
    });

    it('input and button are disabled during submission', async () => {
      // Mock sendMfaOtp to return a promise that we can control
      const promise = new Promise(() => {}); // Never resolves
      mockSendMfaOtp.mockReturnValue(promise);

      render(<MfaOtpForm {...defaultProps} />);

      const input = screen.getByPlaceholderText('Enter TOTP');
      const button = screen.getByRole('button', { name: 'Verify' });

      await user.type(input, '123456');
      await user.click(button);

      expect(input).toBeDisabled();
      expect(button).toBeDisabled();
    });
  });

  describe('Form Submission', () => {
    it('triggers sendMfaOtp with correct code on button click', async () => {
      mockSendMfaOtp.mockResolvedValue({ success: true });

      render(<MfaOtpForm {...defaultProps} />);

      const input = screen.getByPlaceholderText('Enter TOTP');
      const button = screen.getByRole('button', { name: 'Verify' });

      await user.type(input, '123456');
      await user.click(button);

      expect(mockSendMfaOtp).toHaveBeenCalledWith('123456');
      expect(mockSendMfaOtp).toHaveBeenCalledTimes(1);
    });

    it('does not submit when input has fewer than 6 digits', async () => {
      render(<MfaOtpForm {...defaultProps} />);

      const input = screen.getByPlaceholderText('Enter TOTP');
      const button = screen.getByRole('button', { name: 'Verify' });

      await user.type(input, '12345');
      await user.click(button);

      expect(mockSendMfaOtp).not.toHaveBeenCalled();
    });

    it('does not submit multiple times when already submitting', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: Test file
      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockSendMfaOtp.mockReturnValue(promise);

      render(<MfaOtpForm {...defaultProps} />);

      const input = screen.getByPlaceholderText('Enter TOTP');
      const button = screen.getByRole('button', { name: 'Verify' });

      await user.type(input, '123456');
      await user.click(button);
      await user.click(button); // Second click should be ignored

      expect(mockSendMfaOtp).toHaveBeenCalledTimes(1);

      // Resolve the promise to clean up
      resolvePromise!({ success: true });
      await waitFor(async () => {
        await promise;
      });
    });

    it('manages submission state properly', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: Test file
      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockSendMfaOtp.mockReturnValue(promise);

      render(<MfaOtpForm {...defaultProps} />);

      const input = screen.getByPlaceholderText('Enter TOTP');
      const button = screen.getByRole('button', { name: 'Verify' });

      await user.type(input, '123456');
      await user.click(button);

      // During submission
      expect(button).toBeDisabled();
      expect(input).toBeDisabled();

      // Resolve the promise
      resolvePromise!({ success: true });
      await waitFor(async () => {
        await promise;
      });

      // After submission
      await waitFor(() => {
        expect(button).not.toBeDisabled();
        expect(input).not.toBeDisabled();
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error toast when sendMfaOtp returns an error', async () => {
      const errorMessage = 'Invalid TOTP code';

      mockSendMfaOtp.mockRejectedValueOnce({ message: errorMessage });

      render(<MfaOtpForm {...defaultProps} />);

      const input = screen.getByPlaceholderText('Enter TOTP');
      const button = screen.getByRole('button', { name: 'Verify' });

      await user.type(input, '123456');
      await user.click(button);

      await waitFor(() => {
        expect(mocks.toastError).toHaveBeenCalledWith(errorMessage, {});
      });
    });

    it('shows generic error message when no specific error message is provided', async () => {
      mockSendMfaOtp.mockRejectedValueOnce({});

      render(<MfaOtpForm {...defaultProps} />);

      const input = screen.getByPlaceholderText('Enter TOTP');
      const button = screen.getByRole('button', { name: 'Verify' });

      await user.type(input, '123456');
      await user.click(button);

      await waitFor(() => {
        expect(mocks.toastError).toHaveBeenCalledWith(
          'An error occurred. Please try again.',
          {},
        );
      });
    });

    it('handles undefined error gracefully', async () => {
      mockSendMfaOtp.mockResolvedValue({
        error: undefined,
      });

      render(<MfaOtpForm {...defaultProps} />);

      const input = screen.getByPlaceholderText('Enter TOTP');
      const button = screen.getByRole('button', { name: 'Verify' });

      await user.type(input, '123456');
      await user.click(button);

      // Should not throw an error
      await waitFor(() => {
        expect(mockSendMfaOtp).toHaveBeenCalled();
      });
    });
  });

  describe('MFA Ticket Renewal', () => {
    it('calls requestNewMfaTicket when ticket is invalid', async () => {
      // First call - set ticket as invalid
      mockSendMfaOtp.mockRejectedValueOnce({ message: 'Invalid ticket' });
      // Second call - should work
      mockSendMfaOtp.mockResolvedValueOnce({ success: true });

      render(<MfaOtpForm {...defaultProps} />);

      const input = screen.getByPlaceholderText('Enter TOTP');
      const button = screen.getByRole('button', { name: 'Verify' });

      // First submission - creates error and marks ticket invalid
      await user.type(input, '123456');
      await user.click(button);

      await waitFor(() => {
        expect(mocks.toastError).toHaveBeenCalled();
      });

      // Clear input and try again
      await user.clear(input);
      await user.type(input, '654321');
      await user.click(button);

      await waitFor(() => {
        expect(mockRequestNewMfaTicket).toHaveBeenCalled();
      });
    });

    it('does not call requestNewMfaTicket on first submission', async () => {
      mockSendMfaOtp.mockResolvedValue({ success: true });

      render(<MfaOtpForm {...defaultProps} />);

      const input = screen.getByPlaceholderText('Enter TOTP');
      const button = screen.getByRole('button', { name: 'Verify' });

      await user.type(input, '123456');
      await user.click(button);

      expect(mockRequestNewMfaTicket).not.toHaveBeenCalled();
    });

    it('works correctly when requestNewMfaTicket is not provided', async () => {
      const propsWithoutTicketRenewal = {
        sendMfaOtp: mockSendMfaOtp,
        loading: false,
        // biome-ignore lint/suspicious/noExplicitAny: Test file
      } as any;

      mockSendMfaOtp.mockRejectedValueOnce({ message: 'Some error' });

      render(<MfaOtpForm {...propsWithoutTicketRenewal} />);

      const input = screen.getByPlaceholderText('Enter TOTP');
      const button = screen.getByRole('button', { name: 'Verify' });

      await user.type(input, '123456');
      await user.click(button);

      // Should not throw an error even without requestNewMfaTicket
      await waitFor(() => {
        expect(mocks.toastError).toHaveBeenCalled();
      });
    });
  });

  describe('User Interactions', () => {
    it('updates input value correctly when typing', async () => {
      render(<MfaOtpForm {...defaultProps} />);

      const input = screen.getByPlaceholderText('Enter TOTP');

      await user.type(input, '123');
      expect(input).toHaveValue('123');

      await user.type(input, '456');
      expect(input).toHaveValue('123456');
    });

    it('can clear and retype input value', async () => {
      render(<MfaOtpForm {...defaultProps} />);

      const input = screen.getByPlaceholderText('Enter TOTP');

      await user.type(input, '123456');
      expect(input).toHaveValue('123456');

      await user.clear(input);
      expect(input).toHaveValue('');

      await user.type(input, '654321');
      expect(input).toHaveValue('654321');
    });

    it('button triggers submission with valid code', async () => {
      mockSendMfaOtp.mockResolvedValue({ success: true });

      render(<MfaOtpForm {...defaultProps} />);

      const input = screen.getByPlaceholderText('Enter TOTP');
      const button = screen.getByRole('button', { name: 'Verify' });

      await user.type(input, '123456');
      await user.click(button);

      expect(mockSendMfaOtp).toHaveBeenCalledWith('123456');
    });
    it('submits form when pressing Enter key with valid code', async () => {
      mockSendMfaOtp.mockResolvedValue({ success: true });

      render(<MfaOtpForm {...defaultProps} />);

      const input = screen.getByPlaceholderText('Enter TOTP');

      await user.type(input, '123456');
      await user.type(input, '{Enter}');

      expect(mockSendMfaOtp).toHaveBeenCalledWith('123456');
      expect(mockSendMfaOtp).toHaveBeenCalledTimes(1);
    });

    it('does not submit when pressing Enter with invalid code length', async () => {
      render(<MfaOtpForm {...defaultProps} />);

      const input = screen.getByPlaceholderText('Enter TOTP');

      await user.type(input, '12345');
      await user.type(input, '{Enter}');

      expect(mockSendMfaOtp).not.toHaveBeenCalled();
    });

    it('does not submit when pressing Enter while loading', async () => {
      render(<MfaOtpForm {...defaultProps} loading />);

      const input = screen.getByPlaceholderText('Enter TOTP');

      await user.type(input, '123456');
      await user.type(input, '{Enter}');

      expect(mockSendMfaOtp).not.toHaveBeenCalled();
    });

    it('does not submit multiple times when pressing Enter while submitting', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: Test file
      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockSendMfaOtp.mockReturnValue(promise);

      render(<MfaOtpForm {...defaultProps} />);

      const input = screen.getByPlaceholderText('Enter TOTP');

      await user.type(input, '123456');
      await user.type(input, '{Enter}');
      await user.type(input, '{Enter}'); // Second Enter should be ignored

      expect(mockSendMfaOtp).toHaveBeenCalledTimes(1);

      // Clean up
      resolvePromise!({ success: true });
      await waitFor(async () => {
        await promise;
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles null error message gracefully', async () => {
      mockSendMfaOtp.mockRejectedValueOnce({ message: null });

      render(<MfaOtpForm {...defaultProps} />);

      const input = screen.getByPlaceholderText('Enter TOTP');
      const button = screen.getByRole('button', { name: 'Verify' });

      await user.type(input, '123456');
      await user.click(button);

      await waitFor(() => {
        expect(mocks.toastError).toHaveBeenCalledWith(
          'An error occurred. Please try again.',
          {},
        );
      });
    });

    it('prevents multiple rapid submissions', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: Test file
      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockSendMfaOtp.mockReturnValue(promise);

      render(<MfaOtpForm {...defaultProps} />);

      const input = screen.getByPlaceholderText('Enter TOTP');
      const button = screen.getByRole('button', { name: 'Verify' });

      await user.type(input, '123456');

      // Rapid clicks
      await user.click(button);
      await user.click(button);
      await user.click(button);

      expect(mockSendMfaOtp).toHaveBeenCalledTimes(1);

      // Clean up
      resolvePromise!({ success: true });
      await waitFor(async () => {
        await promise;
      });
    });

    it('handles empty input correctly', async () => {
      render(<MfaOtpForm {...defaultProps} />);

      const button = screen.getByRole('button', { name: 'Verify' });

      await user.click(button);

      expect(mockSendMfaOtp).not.toHaveBeenCalled();
      expect(button).toBeDisabled();
    });
  });
});

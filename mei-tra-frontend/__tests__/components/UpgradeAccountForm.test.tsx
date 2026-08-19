import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UpgradeAccountForm } from '@/components/auth/UpgradeAccountForm';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const upgradeAccount = jest.fn();

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ upgradeAccount }),
}));

describe('UpgradeAccountForm', () => {
  beforeEach(() => {
    upgradeAccount.mockReset();
  });

  const fillForm = (email: string, password: string) => {
    fireEvent.change(screen.getByLabelText('email'), {
      target: { value: email },
    });
    fireEvent.change(screen.getByLabelText('password'), {
      target: { value: password },
    });
  };

  it('rejects passwords shorter than 8 characters without calling upgradeAccount', () => {
    render(<UpgradeAccountForm />);
    fillForm('guest@example.com', 'short');

    fireEvent.submit(screen.getByRole('button', { name: 'upgrade.submit' }));

    expect(screen.getByText('upgrade.passwordTooShort')).toBeInTheDocument();
    expect(upgradeAccount).not.toHaveBeenCalled();
  });

  it('shows the confirmation-email message and drops the form when confirmation is pending', async () => {
    upgradeAccount.mockResolvedValue({ error: null, confirmationRequired: true });
    const onUpgraded = jest.fn();
    render(<UpgradeAccountForm onUpgraded={onUpgraded} />);
    fillForm('guest@example.com', 'longenough');

    fireEvent.submit(screen.getByRole('button', { name: 'upgrade.submit' }));

    await waitFor(() => {
      expect(screen.getByText('upgrade.confirmEmailSent')).toBeInTheDocument();
    });
    expect(upgradeAccount).toHaveBeenCalledWith({
      email: 'guest@example.com',
      password: 'longenough',
    });
    expect(onUpgraded).toHaveBeenCalled();
    // Nothing is left to submit once it succeeded.
    expect(
      screen.queryByRole('button', { name: 'upgrade.submit' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText('email')).not.toBeInTheDocument();
  });

  it('reports completion instead of a sent email when no confirmation is needed', async () => {
    upgradeAccount.mockResolvedValue({
      error: null,
      confirmationRequired: false,
    });
    render(<UpgradeAccountForm />);
    fillForm('guest@example.com', 'longenough');

    fireEvent.submit(screen.getByRole('button', { name: 'upgrade.submit' }));

    await waitFor(() => {
      expect(screen.getByText('upgrade.completed')).toBeInTheDocument();
    });
    expect(
      screen.queryByText('upgrade.confirmEmailSent'),
    ).not.toBeInTheDocument();
  });

  it('surfaces the auth error message when the upgrade fails', async () => {
    upgradeAccount.mockResolvedValue({
      error: { message: 'email already registered' },
      confirmationRequired: false,
    });
    render(<UpgradeAccountForm />);
    fillForm('taken@example.com', 'longenough');

    fireEvent.submit(screen.getByRole('button', { name: 'upgrade.submit' }));

    await waitFor(() => {
      expect(screen.getByText('email already registered')).toBeInTheDocument();
    });
  });
});

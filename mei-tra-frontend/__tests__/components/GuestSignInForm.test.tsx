import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GuestSignInForm } from '@/components/auth/GuestSignInForm';

const signInAnonymously = jest.fn();

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const labels: Record<string, string> = {
      guestNameLabel: 'Nickname',
      guestNamePlaceholder: 'Leave blank for a random name',
      guestStart: 'Start with this name',
      guestHint: 'Play instantly without an account.',
      processing: 'Processing…',
      unexpectedError: 'Something went wrong',
    };
    const translator = (key: string, values?: Record<string, number>) =>
      key === 'guestDefaultName'
        ? `Guest ${values?.number ?? ''}`
        : (labels[key] ?? key);
    return translator;
  },
  useLocale: () => 'ja',
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ signInAnonymously, loading: false }),
}));

const typeName = (value: string) =>
  fireEvent.change(screen.getByLabelText('Nickname'), { target: { value } });

const submit = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Start with this name' }));

describe('GuestSignInForm', () => {
  beforeEach(() => {
    signInAnonymously.mockReset();
    signInAnonymously.mockResolvedValue({ error: null });
  });

  it('creates the account with the name that was typed', async () => {
    const onSuccess = jest.fn();
    render(<GuestSignInForm onSuccess={onSuccess} />);

    typeName('  ヒカル   太郎  ');
    submit();

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(signInAnonymously).toHaveBeenCalledWith({
      displayName: 'ヒカル 太郎',
      locale: 'ja',
    });
  });

  it('falls back to a numbered guest name when nothing was typed', async () => {
    render(<GuestSignInForm />);

    submit();

    await waitFor(() => expect(signInAnonymously).toHaveBeenCalledTimes(1));
    expect(signInAnonymously.mock.calls[0][0].displayName).toMatch(
      /^Guest \d{4}$/,
    );
  });

  it('clamps a name that would break the profile row', async () => {
    render(<GuestSignInForm />);

    typeName('あ'.repeat(200));
    submit();

    await waitFor(() => expect(signInAnonymously).toHaveBeenCalledTimes(1));
    expect(signInAnonymously.mock.calls[0][0].displayName).toHaveLength(20);
  });

  it('keeps the form open and shows why when sign-in fails', async () => {
    const onSuccess = jest.fn();
    signInAnonymously.mockResolvedValue({ error: { message: 'nope' } });
    render(<GuestSignInForm onSuccess={onSuccess} />);

    submit();

    expect(await screen.findByText('nope')).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Nickname')).toBeInTheDocument();
  });

  it('does not submit twice while the account is being created', async () => {
    let release: (value: { error: null }) => void = () => {};
    signInAnonymously.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    render(<GuestSignInForm />);

    // Held rather than re-queried: the button relabels to 'Processing…' the
    // moment the first submit lands, which is itself part of the guard.
    const button = screen.getByRole('button', {
      name: 'Start with this name',
    });
    fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Processing…');

    fireEvent.click(button);
    expect(signInAnonymously).toHaveBeenCalledTimes(1);

    release({ error: null });
    await waitFor(() => expect(button).toBeEnabled());
  });
});

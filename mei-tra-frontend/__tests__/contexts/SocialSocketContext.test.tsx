import { render, waitFor } from '@testing-library/react';
import { io } from 'socket.io-client';
import { SocialSocketProvider } from '@/contexts/SocialSocketContext';
import { useAuth } from '@/hooks/useAuth';

jest.mock('@/hooks/useAuth', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/lib/socket-url', () => ({
  getSocketBaseUrl: () => 'http://localhost:3333',
}));

const mockUseAuth = useAuth as jest.Mock;
const mockIo = io as jest.Mock;

describe('SocialSocketProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the current auth session token when connecting to social socket', async () => {
    const getAccessToken = jest.fn();
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      session: { access_token: 'session-token' },
      getAccessToken,
    });

    render(
      <SocialSocketProvider>
        <div>child</div>
      </SocialSocketProvider>,
    );

    await waitFor(() => expect(mockIo).toHaveBeenCalledTimes(1));
    expect(mockIo).toHaveBeenCalledWith('http://localhost:3333/social', expect.objectContaining({
      auth: { token: 'session-token' },
    }));
    expect(getAccessToken).not.toHaveBeenCalled();
  });

  it('falls back to getAccessToken when the session token is not available yet', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      session: null,
      getAccessToken: jest.fn().mockResolvedValue('fallback-token'),
    });

    render(
      <SocialSocketProvider>
        <div>child</div>
      </SocialSocketProvider>,
    );

    await waitFor(() => expect(mockIo).toHaveBeenCalledTimes(1));
    expect(mockIo).toHaveBeenCalledWith('http://localhost:3333/social', expect.objectContaining({
      auth: { token: 'fallback-token' },
    }));
  });
});

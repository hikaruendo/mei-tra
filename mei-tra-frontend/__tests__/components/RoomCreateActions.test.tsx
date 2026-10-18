import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { RoomList } from '@/components/room/RoomList';

const mockCreateRoom = jest.fn();

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { email: 'player@example.com', profile: null } }),
}));

jest.mock('@/hooks/useBackendStatus', () => ({
  useBackendStatus: () => ({ backendStatus: { status: 'ok', isStarting: false }, isLoading: false }),
}));

jest.mock('@/hooks/useRoom', () => ({
  useRoom: () => ({
    availableRooms: [],
    createRoom: mockCreateRoom,
    joinRoom: jest.fn(),
    watchRoom: jest.fn(),
    error: null,
    currentRoom: null,
    isConnected: true,
    isConnecting: false,
  }),
}));

beforeEach(() => {
  mockCreateRoom.mockReset().mockResolvedValue(true);
});

it('separates creation from the searchable room list without an online-status banner', () => {
  render(<RoomList />);

  const createSection = screen.getByRole('region', { name: 'room.create' });
  const listSection = screen.getByRole('region', { name: 'room.title' });
  expect(within(createSection).getByRole('textbox', { name: 'room.roomNameLabel' })).toBeInTheDocument();
  expect(within(createSection).getByRole('spinbutton', { name: 'room.pointsToWin' })).toBeInTheDocument();
  expect(within(createSection).getByRole('button', { name: 'room.createNormal' })).toBeInTheDocument();
  expect(within(createSection).getByRole('button', { name: 'room.createPro' })).toBeInTheDocument();
  expect(within(listSection).getByRole('textbox', { name: 'room.search' })).toBeInTheDocument();
  expect(screen.queryByText('room.backendStatus.ok')).not.toBeInTheDocument();
});

it.each([
  ['room.createNormal', 'normal'],
  ['room.createPro', 'pro'],
])('creates the selected room type via %s with the shared inputs', async (label, mode) => {
  render(<RoomList />);
  fireEvent.change(screen.getByPlaceholderText('room.roomName'), { target: { value: ' Test room ' } });
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '20' } });
  fireEvent.click(screen.getByRole('button', { name: label }));

  await waitFor(() => expect(mockCreateRoom).toHaveBeenCalledWith('Test room', 20, 'random', mode));
});

it('uses the normal mode for Enter and disables both actions until creation finishes', async () => {
  let complete!: (value: boolean) => void;
  mockCreateRoom.mockImplementation(() => new Promise<boolean>((resolve) => { complete = resolve; }));
  render(<RoomList />);
  const normal = screen.getByRole('button', { name: 'room.createNormal' });
  const pro = screen.getByRole('button', { name: 'room.createPro' });
  fireEvent.submit(normal.closest('form')!);

  expect(mockCreateRoom).toHaveBeenCalledWith(expect.any(String), 5, 'random', 'normal');
  expect(normal).toBeDisabled();
  expect(pro).toBeDisabled();

  complete(true);
  await waitFor(() => expect(normal).toBeEnabled());
});

it('disables both actions while the socket is unavailable', () => {
  render(<RoomList isConnected={false} />);
  expect(screen.getByRole('button', { name: 'room.createNormal' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'room.createPro' })).toBeDisabled();
});

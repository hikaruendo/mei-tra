import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProfileEditForm } from '@/components/profile/ProfileEditForm';
import type { UserProfile } from '@/types/user.types';

const updateMock = jest.fn();
const refreshMock = jest.fn();
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({
  user: { id: 'viewer', isAnonymous: true },
  getAccessToken: async () => 'test-token',
  refreshUserProfile: refreshMock,
}) }));
jest.mock('@/app/socket', () => ({ getExistingSocket: () => null }));
jest.mock('@/lib/api/user-profile', () => ({
  updateUserProfileViaApi: (...args: unknown[]) => updateMock(...args),
}));
jest.mock('@/lib/utils/profileUtils', () => ({ clearPlayerProfileCache: jest.fn() }));
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

const profile: UserProfile = {
  id: 'viewer', username: 'viewer', displayName: 'Viewer',
  createdAt: new Date(), updatedAt: new Date(), lastSeenAt: new Date(),
  gamesPlayed: 0, gamesWon: 0, totalScore: 0,
  preferences: { notifications: true, sound: false, theme: 'dark', fontSize: 'large', startPlayerAnimation: false },
};

beforeEach(() => jest.clearAllMocks());

it('saves the chosen design with the existing settings and restores it on reopen', async () => {
  const updated = { ...profile, preferences: { ...profile.preferences, cardDesign: 'densho' as const } };
  updateMock.mockResolvedValue(updated);
  const onSave = jest.fn();
  const { rerender } = render(<ProfileEditForm profile={profile} onSave={onSave} onCancel={jest.fn()} />);
  fireEvent.click(screen.getByRole('radio', { name: 'cardDesign_densho' }));
  fireEvent.click(screen.getByRole('button', { name: 'save' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(updated));
  expect(updateMock).toHaveBeenCalledWith('viewer', 'test-token', expect.objectContaining({ preferences: updated.preferences }));
  expect(refreshMock).toHaveBeenCalledTimes(1);
  rerender(<ProfileEditForm key="reopened" profile={updated} onSave={onSave} onCancel={jest.fn()} />);
  expect(screen.getByRole('radio', { name: 'cardDesign_densho' })).toBeChecked();
  fireEvent.click(screen.getByRole('radio', { name: 'cardDesign_standard' }));
  fireEvent.click(screen.getByRole('button', { name: 'save' }));
  await waitFor(() => expect(updateMock).toHaveBeenLastCalledWith('viewer', 'test-token', expect.objectContaining({ preferences: { ...profile.preferences, cardDesign: 'standard' } })));
});

it('keeps failed and cancelled edits out of the saved profile', async () => {
  updateMock.mockRejectedValue(new Error('Save failed'));
  const onSave = jest.fn();
  const onCancel = jest.fn();
  render(<ProfileEditForm profile={profile} onSave={onSave} onCancel={onCancel} />);
  fireEvent.click(screen.getByRole('radio', { name: 'cardDesign_densho' }));
  fireEvent.click(screen.getByRole('button', { name: 'save' }));
  await screen.findByText('Save failed');
  expect(onSave).not.toHaveBeenCalled();
  expect(refreshMock).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'cancel' }));
  expect(onCancel).toHaveBeenCalledTimes(1);
  expect(profile.preferences.cardDesign).toBeUndefined();
});

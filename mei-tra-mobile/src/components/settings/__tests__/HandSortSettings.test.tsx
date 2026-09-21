import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { t } from '@/i18n';
import { HandSortSettings } from '../HandSortSettings';

const mockUpdate = jest.fn();
const mockRefresh = jest.fn();
const mockProfile = { handSortDirection: 'strong-right' };
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({
  user: { id: 'viewer', profile: mockProfile },
  getAccessToken: async () => 'token', refreshProfile: mockRefresh,
}) }));
jest.mock('@/lib/profile-api', () => ({ updateProfile: (...args: unknown[]) => mockUpdate(...args) }));


type Node = { props: { accessibilityLabel?: string; accessibilityState?: { checked: boolean }; onPress: () => void } };
type Renderer = { root: { findAll: (predicate: (node: Node) => boolean) => Node[] }; update: (value: React.ReactElement) => void; unmount: () => void };
const option = (r: Renderer, direction: string) => r.root.findAll(node => node.props.accessibilityLabel === t(`settings.handSortDirection_${direction}`))[0];

beforeEach(() => { jest.clearAllMocks(); mockProfile.handSortDirection = 'strong-right'; });

it('saves only the changed preference and reflects the refreshed profile', async () => {
  mockUpdate.mockResolvedValue({});
  mockRefresh.mockImplementation(async () => { mockProfile.handSortDirection = 'strong-left'; });
  let r!: Renderer;
  await act(async () => { r = TestRenderer.create(<HandSortSettings />) as unknown as Renderer; });
  await act(async () => option(r, 'strong-left').props.onPress());
  expect(mockUpdate).toHaveBeenCalledWith('viewer', 'token', { preferences: { handSortDirection: 'strong-left' } });
  expect(mockRefresh).toHaveBeenCalledTimes(1);
  expect(option(r, 'strong-left').props.accessibilityState?.checked).toBe(true);
  await act(async () => r.unmount());
});

it('keeps the saved selection when the request fails', async () => {
  mockUpdate.mockRejectedValue(new Error('Save failed'));
  let r!: Renderer;
  await act(async () => { r = TestRenderer.create(<HandSortSettings />) as unknown as Renderer; });
  await act(async () => option(r, 'strong-left').props.onPress());
  expect(mockRefresh).not.toHaveBeenCalled();
  expect(option(r, 'strong-right').props.accessibilityState?.checked).toBe(true);
  await act(async () => r.unmount());
});

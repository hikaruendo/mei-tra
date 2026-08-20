import { Redirect, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BrandHeader } from '@/components/ui/BrandHeader';
import { Button } from '@/components/ui/Button';
import { ConnectionBanner } from '@/components/ui/ConnectionBanner';
import { FeedbackBanner } from '@/components/ui/FeedbackBanner';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/context/AuthContext';
import { useGame } from '@/context/GameContext';
import { colors } from '@/theme/colors';
import { t } from '@/i18n';
import { useLocale } from '@/context/LocaleContext';

export default function RoomsScreen() {
  // Re-render this screen when the app language changes; t() is a bare
  // function and cannot trigger that on its own.
  useLocale();
  const router = useRouter();
  const { user, loading } = useAuth();
  const {
    rooms,
    connectionStatus,
    error,
    notice,
    refreshRooms,
    createRoom,
    joinRoom,
    watchRoom,
    clearFeedback,
  } = useGame();
  const [roomName, setRoomName] = useState('');
  const [pointsToWin, setPointsToWin] = useState('5');
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!refreshing) return;

    const timeout = setTimeout(() => setRefreshing(false), 900);
    return () => clearTimeout(timeout);
  }, [refreshing, rooms]);

  const filteredRooms = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rooms;
    return rooms.filter((room) => room.name.toLowerCase().includes(query));
  }, [rooms, search]);

  if (!loading && !user) {
    return <Redirect href="/sign-in" />;
  }

  if (loading || !user) {
    return (
      <Screen contentStyle={styles.loadingState}>
        <ActivityIndicator color={colors.gold} size="large" />
        <Text accessibilityLiveRegion="polite" style={styles.loadingText}>
          {t('rooms.loadingAccount')}
        </Text>
      </Screen>
    );
  }

  const displayName =
    user?.profile?.displayName ||
    user?.profile?.username ||
    user?.email?.split('@')[0] ||
    'Player';

  const handleCreate = async () => {
    if (submitting || connectionStatus !== 'connected') return;
    setSubmitting(true);
    try {
      const points = Math.max(1, Number(pointsToWin) || 5);
      const name =
        roomName.trim() || t('rooms.defaultRoomName', { name: displayName });
      const success = await createRoom(name, points);
      if (success) {
        router.push('/room/current');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const enterRoom = async (
    roomId: string,
    action: (id: string) => Promise<boolean>,
  ) => {
    if (submitting || connectionStatus !== 'connected') return;
    setSubmitting(true);
    try {
      const success = await action(roomId);
      if (success) {
        router.push(`/room/${roomId}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <FeedbackBanner
        error={error}
        notice={notice}
        onDismiss={clearFeedback}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              setRefreshing(true);
              refreshRooms();
            }}
            refreshing={refreshing}
            tintColor={colors.gold}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.brandWrap}>
            <BrandHeader
              subtitle={t('rooms.greeting', { name: displayName })}
            />
          </View>
          <Button
            accessibilityLabel={t('rooms.openSettings')}
            onPress={() => router.push('../settings')}
            style={styles.settings}
            variant="ghost"
          >
            {t('rooms.profile')}
          </Button>
        </View>

        <ConnectionBanner status={connectionStatus} onRetry={refreshRooms} />

        <View style={styles.createCard}>
          <Text style={styles.sectionTitle}>{t('rooms.createRoom')}</Text>
          <TextInput
            accessibilityLabel={t('rooms.roomName')}
            autoCapitalize="sentences"
            maxLength={80}
            onChangeText={setRoomName}
            placeholder={t('rooms.defaultRoomName', { name: displayName })}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={roomName}
          />
          <View style={styles.pointsRow}>
            <Text style={styles.label}>{t('rooms.pointsToWin')}</Text>
            <TextInput
              accessibilityLabel={t('rooms.pointsToWin')}
              keyboardType="number-pad"
              maxLength={3}
              onChangeText={(value) =>
                setPointsToWin(value.replace(/\D/g, '').slice(0, 3))
              }
              style={[styles.input, styles.pointsInput]}
              value={pointsToWin}
            />
          </View>
          <Button
            disabled={submitting || connectionStatus !== 'connected'}
            loading={submitting}
            onPress={handleCreate}
          >
            {t('rooms.create')}
          </Button>
        </View>

        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>{t('rooms.joinable')}</Text>
          <TextInput
            accessibilityLabel={t('rooms.searchRooms')}
            onChangeText={setSearch}
            placeholder={t('rooms.searchPlaceholder')}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={search}
          />

          {filteredRooms.map((room) => {
            const players = room.players.filter(
              (player, index, all) =>
                all.findIndex(
                  (candidate) => candidate.seatId === player.seatId,
                ) === index,
            );
            const humans = players.filter((player) => !player.isCOM);
            const hasCOM = players.some((player) => player.isCOM);
            const canJoin =
              (room.status !== 'playing' &&
                humans.length < room.settings.maxPlayers) ||
              (room.status === 'playing' && hasCOM);
            const canWatch =
              room.status === 'playing' && room.settings.allowSpectators;

            return (
              <View key={room.id} style={styles.roomCard}>
                <View style={styles.roomHeading}>
                  <View style={styles.roomTitleWrap}>
                    <Text numberOfLines={1} style={styles.roomTitle}>
                      {room.name}
                    </Text>
                    <Text style={styles.roomMeta}>
                      {t('rooms.capacity', {
                        current: humans.length,
                        max: room.settings.maxPlayers,
                      })}
                      {t('rooms.pointsSuffix', {
                        points: room.settings.pointsToWin,
                      })}
                    </Text>
                  </View>
                  <Text style={styles.status}>
                    {room.status === 'playing'
                      ? t('rooms.statusPlaying')
                      : t('rooms.statusWaiting')}
                  </Text>
                </View>
                <Text numberOfLines={2} style={styles.players}>
                  {players.map((player) => player.name).join(', ') ||
                    t('rooms.noParticipants')}
                </Text>
                <View style={styles.roomActions}>
                  {canJoin ? (
                    <Button
                      disabled={
                        submitting || connectionStatus !== 'connected'
                      }
                      onPress={() => enterRoom(room.id, joinRoom)}
                      style={styles.roomAction}
                    >
                      {t('rooms.join')}
                    </Button>
                  ) : null}
                  {canWatch ? (
                    <Button
                      disabled={
                        submitting || connectionStatus !== 'connected'
                      }
                      onPress={() => enterRoom(room.id, watchRoom)}
                      style={styles.roomAction}
                      variant="secondary"
                    >
                      {t('rooms.watch')}
                    </Button>
                  ) : null}
                </View>
              </View>
            );
          })}

          {filteredRooms.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {search.trim()
                  ? t('rooms.noMatch')
                  : t('rooms.noneAvailable')}
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    gap: 18,
    padding: 18,
    paddingBottom: 42,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  brandWrap: {
    flex: 1,
    minWidth: 0,
  },
  settings: {
    minHeight: 42,
    paddingHorizontal: 10,
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: 24,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 16,
  },
  createCard: {
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '800',
  },
  input: {
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundElevated,
    color: colors.text,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  label: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
  },
  pointsInput: {
    width: 90,
    textAlign: 'center',
  },
  listSection: {
    gap: 12,
  },
  roomCard: {
    gap: 10,
    padding: 15,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  roomHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  roomTitleWrap: {
    flex: 1,
    gap: 3,
  },
  roomTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '800',
  },
  roomMeta: {
    color: colors.textMuted,
    fontSize: 13,
  },
  status: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '700',
  },
  players: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  roomActions: {
    flexDirection: 'row',
    gap: 10,
  },
  roomAction: {
    flex: 1,
  },
  empty: {
    minHeight: 100,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 15,
  },
});

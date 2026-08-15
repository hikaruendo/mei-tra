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

export default function RoomsScreen() {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
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
          アカウント情報を読み込んでいます
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
      const name = roomName.trim() || `${displayName}の部屋`;
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
            <BrandHeader subtitle={`${displayName}さん、対局を始めましょう`} />
          </View>
          <Button
            accessibilityLabel="設定を開く"
            onPress={() => router.push('../settings')}
            style={styles.settings}
            variant="ghost"
          >
            設定
          </Button>
          <Button
            accessibilityLabel="ログアウト"
            variant="ghost"
            onPress={async () => {
              if (submitting) return;
              setSubmitting(true);
              try {
                await signOut();
                router.replace('/sign-in');
              } finally {
                setSubmitting(false);
              }
            }}
            style={styles.logout}
            disabled={submitting}
          >
            ログアウト
          </Button>
        </View>

        <ConnectionBanner status={connectionStatus} onRetry={refreshRooms} />

        <View style={styles.createCard}>
          <Text style={styles.sectionTitle}>部屋を作る</Text>
          <TextInput
            accessibilityLabel="部屋名"
            autoCapitalize="sentences"
            maxLength={80}
            onChangeText={setRoomName}
            placeholder={`${displayName}の部屋`}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={roomName}
          />
          <View style={styles.pointsRow}>
            <Text style={styles.label}>勝利点数</Text>
            <TextInput
              accessibilityLabel="勝利点数"
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
            ルーム作成
          </Button>
        </View>

        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>参加できる部屋</Text>
          <TextInput
            accessibilityLabel="部屋を検索"
            onChangeText={setSearch}
            placeholder="部屋名で検索"
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
                      {humans.length}/{room.settings.maxPlayers}人・
                      {room.settings.pointsToWin}点先取
                    </Text>
                  </View>
                  <Text style={styles.status}>
                    {room.status === 'playing' ? '対局中' : '待機中'}
                  </Text>
                </View>
                <Text numberOfLines={2} style={styles.players}>
                  {players.map((player) => player.name).join('・') || '参加者なし'}
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
                      参加
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
                      観戦
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
                  ? '条件に合う部屋はありません'
                  : '現在参加できる部屋はありません'}
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
  logout: {
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

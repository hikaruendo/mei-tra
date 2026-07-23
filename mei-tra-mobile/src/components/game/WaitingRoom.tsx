import type { RoomContract } from '@meitra/contracts/room';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Button } from '@/components/ui/Button';
import { colors } from '@/theme/colors';

interface WaitingRoomProps {
  room: RoomContract;
  currentPlayerId: string | null;
  isHost: boolean;
  onToggleReady: () => void;
  onFillWithCOM: () => void;
  onShuffle: () => void;
  onStart: () => void;
  onLeave: () => void;
  actionsDisabled?: boolean;
}

export function WaitingRoom({
  room,
  currentPlayerId,
  isHost,
  onToggleReady,
  onFillWithCOM,
  onShuffle,
  onStart,
  onLeave,
  actionsDisabled = false,
}: WaitingRoomProps) {
  const currentPlayer = room.players.find(
    (player) => player.playerId === currentPlayerId,
  );
  const humans = room.players.filter((player) => !player.isCOM);
  const canStart =
    isHost &&
    room.players.length === room.settings.maxPlayers &&
    humans.every(
      (player) => player.isHost || player.isReady || player.playerId === currentPlayerId,
    );
  const { width } = useWindowDimensions();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setPendingAction(null);
  }, [actionsDisabled, room]);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  const runAction = (
    name: string,
    action: () => void,
  ) => {
    if (actionsDisabled || pendingAction) return;
    setPendingAction(name);
    action();
    timeoutRef.current = setTimeout(() => setPendingAction(null), 1800);
  };

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <Text style={styles.title}>{room.name}</Text>
        <Text style={styles.subtitle}>
          {room.players.length}/{room.settings.maxPlayers}席・
          {room.settings.pointsToWin}点先取
        </Text>
      </View>

      <View style={[styles.teams, width < 380 && styles.teamsNarrow]}>
        {[0, 1].map((team) => (
          <View key={team} style={styles.team}>
            <Text style={styles.teamTitle}>チーム{team + 1}</Text>
            {[0, 1].map((seat) => {
              const player = room.players.filter(
                (candidate) => candidate.team === team,
              )[seat];
              return (
                <View
                  accessibilityLabel={`${player?.name ?? '空席'}、${
                    player?.isReady ? '準備OK' : player ? '準備中' : '参加待ち'
                  }`}
                  accessibilityRole="text"
                  key={seat}
                  style={styles.seat}
                >
                  <Text style={styles.seatAvatar}>
                    {player?.isCOM ? '🤖' : player ? '●' : '○'}
                  </Text>
                  <View style={styles.seatText}>
                    <Text numberOfLines={1} style={styles.playerName}>
                      {player?.name ?? '空席'}
                    </Text>
                    <Text style={styles.ready}>
                      {player?.isHost
                        ? 'ホスト'
                        : player?.isCOM
                          ? 'COM'
                          : player?.isReady
                            ? '準備OK'
                            : player
                              ? '準備中'
                              : '参加待ち'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </View>

      {!isHost && currentPlayer ? (
        <Button
          disabled={actionsDisabled || Boolean(pendingAction)}
          loading={pendingAction === 'ready'}
          onPress={() => runAction('ready', onToggleReady)}
        >
          {currentPlayer.isReady ? '準備を取り消す' : '準備OK'}
        </Button>
      ) : null}

      {isHost ? (
        <View style={styles.hostActions}>
          <Button
            disabled={actionsDisabled || Boolean(pendingAction)}
            loading={pendingAction === 'com'}
            onPress={() => runAction('com', onFillWithCOM)}
            variant="secondary"
          >
            空席をCOMで埋める
          </Button>
          <Button
            disabled={actionsDisabled || Boolean(pendingAction)}
            loading={pendingAction === 'shuffle'}
            onPress={() => runAction('shuffle', onShuffle)}
            variant="secondary"
          >
            チームをシャッフル
          </Button>
          <Button
            disabled={!canStart || actionsDisabled || Boolean(pendingAction)}
            loading={pendingAction === 'start'}
            onPress={() => runAction('start', onStart)}
          >
            ゲーム開始
          </Button>
          {!canStart ? (
            <Text style={styles.hint}>
              4席を埋め、参加者が準備すると開始できます
            </Text>
          ) : null}
        </View>
      ) : (
        <Text style={styles.hint}>ホストのゲーム開始を待っています</Text>
      )}

      <Button
        disabled={actionsDisabled || Boolean(pendingAction)}
        loading={pendingAction === 'leave'}
        onPress={() => runAction('leave', onLeave)}
        variant="ghost"
      >
        退出
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 18,
    padding: 18,
  },
  heading: {
    gap: 4,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
  },
  teams: {
    flexDirection: 'row',
    gap: 12,
  },
  teamsNarrow: {
    gap: 8,
  },
  team: {
    flex: 1,
    minWidth: 0,
    gap: 10,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  teamTitle: {
    color: colors.gold,
    fontSize: 17,
    fontWeight: '800',
  },
  seat: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: 12,
    backgroundColor: colors.backgroundElevated,
  },
  seatAvatar: {
    fontSize: 26,
  },
  seatText: {
    flex: 1,
    gap: 3,
  },
  playerName: {
    maxWidth: '100%',
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  ready: {
    color: colors.textMuted,
    fontSize: 12,
  },
  hostActions: {
    gap: 10,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
});

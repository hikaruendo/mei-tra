import type { TeamNames } from '@meitra/contracts/game';
import type { RoomContract } from '@meitra/contracts/room';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { ChatPanel } from '@/components/social/ChatPanel';
import { Button } from '@/components/ui/Button';
import { getTeamDisplayName } from '@/lib/team-labels';
import { colors, teamColors } from '@/theme/colors';

interface WaitingRoomProps {
  room: RoomContract;
  currentPlayerId: string | null;
  isHost: boolean;
  onShuffle: () => void;
  onStart: () => void;
  onLeave: () => void;
  onRemovePlayer: (playerId: string) => void;
  onReplaceWithCOM: (playerId: string) => void;
  onUpdateTeamNames: (teamNames: TeamNames) => void;
  actionsDisabled?: boolean;
}

export function WaitingRoom({
  room,
  currentPlayerId,
  isHost,
  onShuffle,
  onStart,
  onLeave,
  onRemovePlayer,
  onReplaceWithCOM,
  onUpdateTeamNames,
  actionsDisabled = false,
}: WaitingRoomProps) {
  const canStart =
    isHost &&
    room.players.length === room.settings.maxPlayers;
  const { width } = useWindowDimensions();
  const [showChat, setShowChat] = useState(false);
  const [showTeamNameEditor, setShowTeamNameEditor] = useState(false);
  const [draftTeamNames, setDraftTeamNames] = useState<Record<0 | 1, string>>({
    0: '',
    1: '',
  });
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraftTeamNames({
      0: room.settings.teamNames?.[0] || `チーム1`,
      1: room.settings.teamNames?.[1] || `チーム2`,
    });
  }, [room.settings.teamNames]);

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
        {([0, 1] as const).map((team) => {
          const teamLabel = getTeamDisplayName(team, room.settings.teamNames);
          const teamColor = teamColors[team];
          return (
          <View key={team} style={styles.team}>
            <View style={styles.teamHeader}>
              <View style={[styles.teamBadge, { borderColor: teamColor }]}>
                <Text style={[styles.teamBadgeText, { color: teamColor }]}>
                  {teamLabel}
                </Text>
              </View>
            </View>
            {[0, 1].map((seat) => {
              const player = room.players.filter(
                (candidate) => candidate.team === team,
              )[seat];
              const canRemove =
                isHost &&
                player &&
                !player.isHost &&
                !player.isCOM &&
                player.playerId !== currentPlayerId;
              const seatView = (
                <View
                  accessibilityLabel={`${player?.name ?? '空席'}、${
                    player ? (player.isHost ? 'ホスト' : player.isCOM ? 'COM' : '参加中') : '参加待ち'
                  }`}
                  accessibilityRole="text"
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
                          : player
                            ? '参加中'
                            : '参加待ち'}
                    </Text>
                  </View>
                </View>
              );
              if (canRemove) {
                return (
                  <Pressable
                    key={seat}
                    onLongPress={() => {
                      Alert.alert(
                        player.name,
                        'プレイヤーの操作を選択してください',
                        [
                          {
                            text: 'COMに置換',
                            onPress: () =>
                              onReplaceWithCOM(player.playerId),
                          },
                          {
                            text: '退出させる',
                            style: 'destructive',
                            onPress: () =>
                              onRemovePlayer(player.playerId),
                          },
                          { text: 'キャンセル', style: 'cancel' },
                        ],
                      );
                    }}
                  >
                    {seatView}
                  </Pressable>
                );
              }
              return (
                <View key={seat}>{seatView}</View>
              );
            })}
          </View>
          );
        })}
      </View>

      {isHost ? (
        showTeamNameEditor ? (
          <View style={styles.teamNamePanel}>
            <View style={styles.teamNamePanelHeader}>
              <Text style={styles.teamNamePanelTitle}>チーム名</Text>
              {([0, 1] as const).map((t) => (
                <View
                  key={t}
                  style={[
                    styles.teamColorDot,
                    { borderColor: teamColors[t] },
                  ]}
                >
                  <Text style={[styles.teamColorDotText, { color: teamColors[t] }]}>
                    {draftTeamNames[t].slice(0, 1) || `${t + 1}`}
                  </Text>
                </View>
              ))}
              <Pressable onPress={() => setShowTeamNameEditor(false)}>
                <Text style={styles.teamNameClose}>閉じる</Text>
              </Pressable>
            </View>
            {([0, 1] as const).map((t) => (
              <View key={t} style={styles.teamNameRow}>
                <View
                  style={[
                    styles.teamColorLabel,
                    { borderColor: teamColors[t] },
                  ]}
                >
                  <Text style={[styles.teamColorLabelText, { color: teamColors[t] }]}>
                    {t === 0 ? '赤' : '黒'}
                  </Text>
                </View>
                <TextInput
                  maxLength={16}
                  onChangeText={(text) =>
                    setDraftTeamNames((prev) => ({ ...prev, [t]: text }))
                  }
                  placeholder={`チーム${t + 1}`}
                  placeholderTextColor={colors.textMuted}
                  style={styles.teamNameInput}
                  value={draftTeamNames[t]}
                />
              </View>
            ))}
            <Button
              disabled={actionsDisabled}
              onPress={() => {
                const names: TeamNames = {};
                if (draftTeamNames[0].trim()) names[0] = draftTeamNames[0].trim();
                if (draftTeamNames[1].trim()) names[1] = draftTeamNames[1].trim();
                onUpdateTeamNames(names);
                setShowTeamNameEditor(false);
              }}
              variant="secondary"
            >
              保存
            </Button>
          </View>
        ) : (
          <Pressable
            onPress={() => setShowTeamNameEditor(true)}
            style={styles.editTeamNamesButton}
          >
            <Text style={styles.editTeamNamesLabel}>チーム名</Text>
            {([0, 1] as const).map((t) => (
              <View
                key={t}
                style={[
                  styles.teamColorDot,
                  { borderColor: teamColors[t] },
                ]}
              >
                <Text style={[styles.teamColorDotText, { color: teamColors[t] }]}>
                  {(room.settings.teamNames?.[t] || `チーム${t + 1}`).slice(0, 1)}
                </Text>
              </View>
            ))}
            <Text style={styles.editTeamNamesAction}>編集</Text>
          </Pressable>
        )
      ) : null}

      {isHost ? (
        <View style={styles.hostActions}>
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
              4席を埋めると開始できます
            </Text>
          ) : null}
        </View>
      ) : (
        <Text style={styles.hint}>ホストのゲーム開始を待っています</Text>
      )}

      <View style={styles.bottomActions}>
        <Button
          onPress={() => setShowChat(true)}
          style={styles.chatButton}
          variant="secondary"
        >
          チャット
        </Button>
        <Button
          disabled={actionsDisabled || Boolean(pendingAction)}
          loading={pendingAction === 'leave'}
          onPress={() => runAction('leave', onLeave)}
          style={styles.leaveButton}
          variant="ghost"
        >
          退出
        </Button>
      </View>

      <Modal
        animationType="slide"
        onRequestClose={() => setShowChat(false)}
        transparent
        visible={showChat}
      >
        <View style={styles.chatOverlay}>
          <View style={styles.chatCard}>
            <View style={styles.chatHeader}>
              <Text style={styles.chatTitle}>チャット</Text>
              <Button
                onPress={() => setShowChat(false)}
                variant="ghost"
              >
                閉じる
              </Button>
            </View>
            <ChatPanel roomId={room.id} />
          </View>
        </View>
      </Modal>
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
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  teamBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: colors.panelStrong,
    borderWidth: 1,
  },
  teamBadgeText: {
    fontSize: 14,
    fontWeight: '800',
  },
  editTeamNamesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  editTeamNamesLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  editTeamNamesAction: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: '700',
  },
  teamColorDot: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.panelStrong,
    borderWidth: 1.5,
  },
  teamColorDotText: {
    fontSize: 11,
    fontWeight: '800',
  },
  teamNamePanel: {
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  teamNamePanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teamNamePanelTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  teamNameClose: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },
  teamNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  teamColorLabel: {
    width: 36,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: colors.panelStrong,
    borderWidth: 1.5,
  },
  teamColorLabelText: {
    fontSize: 13,
    fontWeight: '800',
  },
  teamNameInput: {
    flex: 1,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundElevated,
    color: colors.text,
    fontSize: 15,
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
  bottomActions: {
    flexDirection: 'row',
    gap: 10,
  },
  chatButton: {
    flex: 1,
  },
  leaveButton: {
    flex: 1,
  },
  chatOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  chatCard: {
    maxHeight: '80%',
    flex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: colors.background,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 8,
  },
  chatTitle: {
    color: colors.gold,
    fontSize: 20,
    fontWeight: '800',
  },
});
